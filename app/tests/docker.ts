// A read-only client for the Docker engine API, over the unix socket the
// `test` compose service mounts.
//
// This exists for one test: the log-capture proof (tests/no-logging.test.ts).
// Container output only exists OUTSIDE the container that produced it, so a
// suite that cannot reach the engine cannot check whether the composition
// logged a searched address -- it could only re-assert that the application
// does not, which is the claim rather than the evidence.
//
// It reads. It lists containers in this compose project, inspects them, and
// pulls their logs. There is no write path here, and adding one would be a
// change worth arguing about in review.
//
// Not named *.test.ts on purpose: `npm test` globs tests/*.test.ts, and this
// is a helper, not a suite.

import http from "node:http";
import os from "node:os";

const SOCKET = process.env.DOCKER_SOCKET ?? "/var/run/docker.sock";

export class DockerUnavailableError extends Error {}

function apiGet(pathname: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { socketPath: SOCKET, path: pathname, method: "GET" },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => {
          const body = Buffer.concat(chunks);
          const status = res.statusCode ?? 0;
          if (status >= 400) {
            reject(
              new DockerUnavailableError(
                `docker engine API returned ${status} for ${pathname}`,
              ),
            );
            return;
          }
          resolve(body);
        });
      },
    );
    req.on("error", (err) =>
      reject(
        new DockerUnavailableError(
          `could not reach the docker engine on ${SOCKET}: ${err.message}`,
        ),
      ),
    );
    req.end();
  });
}

async function apiGetJson<T>(pathname: string): Promise<T> {
  return JSON.parse((await apiGet(pathname)).toString("utf8")) as T;
}

interface InspectResponse {
  Id: string;
  Name: string;
  /** The container's entrypoint, and the arguments it was actually started with. */
  Path: string;
  Args: string[];
  Config: { Labels: Record<string, string>; Cmd: string[] | null; Env: string[] | null };
  HostConfig: { ExtraHosts: string[] | null };
}

interface ListedContainer {
  Id: string;
  Names: string[];
  Labels: Record<string, string>;
}

/** This container, found by hostname -- which docker sets to the container id. */
export async function inspectSelf(): Promise<InspectResponse> {
  return apiGetJson<InspectResponse>(`/containers/${os.hostname()}/json`);
}

export async function inspectContainer(id: string): Promise<InspectResponse> {
  return apiGetJson<InspectResponse>(`/containers/${id}/json`);
}

/** Every container in this compose project, running or exited. */
export async function projectContainers(): Promise<ListedContainer[]> {
  const self = await inspectSelf();
  const project = self.Config.Labels["com.docker.compose.project"];
  if (!project) {
    throw new DockerUnavailableError(
      "this container carries no com.docker.compose.project label, so the " +
        "set of containers to capture logs from cannot be determined",
    );
  }
  const filters = encodeURIComponent(
    JSON.stringify({ label: [`com.docker.compose.project=${project}`] }),
  );
  return apiGetJson<ListedContainer[]>(`/containers/json?all=1&filters=${filters}`);
}

/**
 * Split docker's multiplexed log stream back into text.
 *
 * A non-TTY container's log stream is a sequence of 8-byte frame headers
 * (stream id, three zero bytes, big-endian length) followed by payload. A TTY
 * container's is raw. This handles both, and the caller also searches the raw
 * bytes -- see captureLogs.
 */
function demultiplex(buf: Buffer): string {
  let out = "";
  let i = 0;
  while (i < buf.length) {
    const isFrameHeader =
      i + 8 <= buf.length &&
      buf[i] !== undefined &&
      buf[i]! <= 2 &&
      buf[i + 1] === 0 &&
      buf[i + 2] === 0 &&
      buf[i + 3] === 0;
    if (!isFrameHeader) {
      out += buf.subarray(i).toString("utf8");
      break;
    }
    const len = buf.readUInt32BE(i + 4);
    const end = Math.min(i + 8 + len, buf.length);
    out += buf.subarray(i + 8, end).toString("utf8");
    i = end;
  }
  return out;
}

export interface CapturedStream {
  /** The container's compose name, e.g. `somap-db-1`. */
  readonly container: string;
  /** stdout + stderr, de-framed. */
  readonly text: string;
  /** The same bytes, undecoded, so nothing can hide in the framing. */
  readonly raw: string;
  readonly bytes: number;
}

/**
 * Every byte of stdout and stderr every container in this project has emitted
 * since it started. `tail=all`, not a window: a leak that happened before the
 * test started is still a leak.
 *
 * ONE STREAM IS EXCLUDED, AND THIS IS THE WHOLE OF IT: the `test` service's own
 * containers. The test harness prints the probe address by name in every
 * assertion message and in every test title -- it is the apparatus doing the
 * looking, not a somap log stream, and including it would mean the evidence
 * fails itself for containing the evidence. The `test` service is a job behind
 * a compose profile; `docker compose up` never starts it, and it is not part of
 * the production composition. Nothing else is filtered: db, app, migrate, and
 * anything else in the project are all read in full.
 */
export async function captureLogs(): Promise<CapturedStream[]> {
  const all = await projectContainers();
  const containers = all.filter(
    (c) => c.Labels["com.docker.compose.service"] !== "test",
  );
  if (containers.length === 0) {
    throw new DockerUnavailableError(
      "no containers found for this compose project -- a capture with nothing " +
        "in it is not evidence of anything",
    );
  }
  const streams: CapturedStream[] = [];
  for (const c of containers) {
    const buf = await apiGet(
      `/containers/${c.Id}/logs?stdout=1&stderr=1&tail=all&timestamps=0`,
    );
    streams.push({
      container: (c.Names[0] ?? c.Id).replace(/^\//, ""),
      text: demultiplex(buf),
      raw: buf.toString("latin1"),
      bytes: buf.length,
    });
  }
  return streams;
}

/** Every IPv4/IPv6 address this container presents to `app` as a client IP. */
export function ownAddresses(): string[] {
  const addresses: string[] = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const iface of list ?? []) {
      if (!iface.internal) addresses.push(iface.address);
    }
  }
  return addresses;
}
