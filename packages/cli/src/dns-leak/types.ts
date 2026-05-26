export type DnsLeakVerdict = "no_leak" | "leak" | "inconclusive";

export type DnsServer = {
  ip: string;
  country: string | null;
  countryCode: string | null;
  city: string | null;
  isp: string | null;
  asn: number | null;
  asOrg: string | null;
  leaked: boolean;
};

export type DnsLeakOutput = {
  token: string;
  rounds: number;
  userIp: string | null;
  userCountry: string | null;
  userCountryCode: string | null;
  dnsServers: DnsServer[];
  count: number;
  verdict: DnsLeakVerdict;
};
