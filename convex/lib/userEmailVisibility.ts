export function obfuscateEmail(email: string | null | undefined): string | null {
  if (!email) {
    return null;
  }

  const trimmed = email.trim();
  if (!trimmed) {
    return null;
  }

  const atIndex = trimmed.indexOf("@");
  if (atIndex <= 0) {
    return trimmed;
  }

  const localPart = trimmed.slice(0, atIndex);
  const domainPart = trimmed.slice(atIndex + 1);
  const [domainName, ...domainTail] = domainPart.split(".");

  const localPrefix = localPart.slice(0, Math.min(2, localPart.length));
  const domainPrefix = domainName.slice(0, Math.min(2, domainName.length));

  return `${localPrefix}${localPart.length > 2 ? "***" : ""}@${domainPrefix}${domainName.length > 2 ? "***" : ""}${domainTail.length > 0 ? `.${domainTail.join(".")}` : ""}`;
}

export function resolveDisplayNameOrObfuscatedEmail(args: {
  name: string | null | undefined;
  email: string | null | undefined;
}): string | null {
  const name = args.name?.trim() ?? "";
  if (name) {
    return name;
  }

  return obfuscateEmail(args.email);
}

export function resolveEmailForViewer(args: {
  name?: string | null | undefined;
  email: string | null | undefined;
  canViewRawEmail: boolean;
}): string | null {
  if (args.canViewRawEmail) {
    return args.email ?? null;
  }

  const name = args.name?.trim() ?? "";
  if (name) {
    return null;
  }

  return obfuscateEmail(args.email);
}
