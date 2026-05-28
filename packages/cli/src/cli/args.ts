import { parseArgs as nodeParseArgs } from "node:util";

export type RunCommand = {
  type: "run";
  mode: "all" | "connect" | "split";
  names?: string[];
};

export type AddCommand = {
  type: "add";
  name: string;
  method: "cftrace" | "http-header" | "http-ping";
  domain?: string;
  url?: string;
  headers?: string[];
};

export type NameCommand = {
  type: "remove" | "disable" | "enable";
  name: string;
};

export type DnsCommand = {
  type: "dns";
  rounds?: number;
  extended: boolean;
};

export type SimpleCommand = {
  type: "list" | "config-path" | "config-show" | "config-init" | "version" | "help";
};

export type Command = RunCommand | AddCommand | NameCommand | DnsCommand | SimpleCommand;

export type Flags = {
  json: boolean;
  noColor: boolean;
  timeout?: number;
  concurrency?: number;
  config?: string;
  category?: string;
  tier?: number;
  rounds?: number;
  extended?: boolean;
  proxy?: string;
  noProxy?: boolean;
};

export type ParseSuccess = {
  ok: true;
  command: Command;
  flags: Flags;
};

export type ParseFailure = {
  ok: false;
  error: string;
};

export type ParseResult = ParseSuccess | ParseFailure;

export function parseCliArgs(argv: string[]): ParseResult {
  let parsed: ReturnType<typeof nodeParseArgs>;
  try {
    parsed = nodeParseArgs({
      args: argv,
      options: {
        json: { type: "boolean", default: false },
        "no-color": { type: "boolean", default: false },
        timeout: { type: "string" },
        concurrency: { type: "string" },
        config: { type: "string" },
        category: { type: "string" },
        tier: { type: "string" },
        version: { type: "boolean", default: false },
        help: { type: "boolean", default: false },
        method: { type: "string" },
        url: { type: "string" },
        header: { type: "string", multiple: true },
        rounds: { type: "string" },
        extended: { type: "boolean", default: false },
        proxy: { type: "string" },
        "no-proxy": { type: "boolean", default: false },
      },
      allowPositionals: true,
      strict: false,
    });
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const flags: Flags = {
    json: parsed.values.json as boolean,
    noColor: parsed.values["no-color"] as boolean,
  };

  if (parsed.values.timeout) {
    const v = Number(parsed.values.timeout as string);
    if (!Number.isInteger(v) || v < 100 || v > 60000) {
      return { ok: false, error: "--timeout must be an integer between 100 and 60000" };
    }
    flags.timeout = v;
  }
  if (parsed.values.concurrency) {
    const v = Number(parsed.values.concurrency as string);
    if (!Number.isInteger(v) || v < 1 || v > 20) {
      return { ok: false, error: "--concurrency must be an integer between 1 and 20" };
    }
    flags.concurrency = v;
  }
  if (parsed.values.config) {
    flags.config = parsed.values.config as string;
  }
  if (parsed.values.category) {
    flags.category = parsed.values.category as string;
  }
  if (parsed.values.tier) {
    const v = Number(parsed.values.tier as string);
    if (!Number.isInteger(v) || v < 1 || v > 9) {
      return { ok: false, error: "--tier must be an integer between 1 and 9" };
    }
    flags.tier = v;
  }
  if (parsed.values.rounds) {
    const v = Number(parsed.values.rounds as string);
    if (!Number.isInteger(v) || v < 1 || v > 20) {
      return { ok: false, error: "--rounds must be an integer between 1 and 20" };
    }
    flags.rounds = v;
  }
  if (parsed.values.extended) {
    flags.extended = true;
  }
  if (parsed.values.proxy) {
    flags.proxy = parsed.values.proxy as string;
  }
  if (parsed.values["no-proxy"]) {
    flags.noProxy = true;
  }

  if (parsed.values.version) {
    return { ok: true, command: { type: "version" }, flags };
  }
  if (parsed.values.help) {
    return { ok: true, command: { type: "help" }, flags };
  }

  const positionals = parsed.positionals;
  const sub = positionals[0];

  if (!sub) {
    return { ok: true, command: { type: "run", mode: "all" }, flags };
  }

  switch (sub) {
    case "split": {
      const names = positionals.slice(1);
      return {
        ok: true,
        command: {
          type: "run",
          mode: "split",
          names: names.length > 0 ? names : undefined,
        },
        flags,
      };
    }
    case "connect":
      return { ok: true, command: { type: "run", mode: "connect" }, flags };
    case "list":
      return { ok: true, command: { type: "list" }, flags };
    case "add":
      return parseAdd(positionals, parsed.values as Record<string, unknown>, flags);
    case "remove": {
      const name = positionals[1];
      if (!name) return { ok: false, error: "remove requires a name" };
      return { ok: true, command: { type: "remove", name }, flags };
    }
    case "disable": {
      const name = positionals[1];
      if (!name) return { ok: false, error: "disable requires a name" };
      return { ok: true, command: { type: "disable", name }, flags };
    }
    case "enable": {
      const name = positionals[1];
      if (!name) return { ok: false, error: "enable requires a name" };
      return { ok: true, command: { type: "enable", name }, flags };
    }
    case "dns":
      return parseDns(flags);
    case "config": {
      const subCmd = positionals[1];
      if (subCmd === "path") return { ok: true, command: { type: "config-path" }, flags };
      if (subCmd === "show") return { ok: true, command: { type: "config-show" }, flags };
      if (subCmd === "init") return { ok: true, command: { type: "config-init" }, flags };
      return { ok: false, error: `Unknown config subcommand: ${subCmd}` };
    }
    default:
      return { ok: false, error: `Unknown command: ${sub}` };
  }
}

function parseAdd(
  positionals: string[],
  values: Record<string, unknown>,
  flags: Flags,
): ParseResult {
  const name = positionals[1];
  if (!name) return { ok: false, error: "add requires a name" };

  const domain = positionals[2];
  const method = (values.method as string) ?? (domain ? "cftrace" : undefined);

  if (domain && method && method !== "cftrace") {
    return {
      ok: false,
      error: "Positional domain argument is only valid for cftrace method",
    };
  }

  if (method === "cftrace" || (!method && domain)) {
    if (!domain) return { ok: false, error: "cftrace method requires a domain" };
    return {
      ok: true,
      command: { type: "add", name, method: "cftrace", domain },
      flags,
    };
  }

  if (method === "http-header") {
    const url = values.url as string | undefined;
    const headers = values.header as string[] | undefined;
    if (!url) return { ok: false, error: "http-header method requires --url" };
    if (!headers || headers.length === 0)
      return { ok: false, error: "http-header method requires --header" };
    return {
      ok: true,
      command: { type: "add", name, method: "http-header", url, headers },
      flags,
    };
  }

  if (method === "http-ping") {
    const url = values.url as string | undefined;
    if (!url) return { ok: false, error: "http-ping method requires --url" };
    return {
      ok: true,
      command: { type: "add", name, method: "http-ping", url },
      flags,
    };
  }

  return { ok: false, error: "add requires a domain or --method" };
}

function parseDns(flags: Flags): ParseResult {
  return {
    ok: true,
    command: { type: "dns", rounds: flags.rounds, extended: flags.extended ?? false },
    flags,
  };
}
