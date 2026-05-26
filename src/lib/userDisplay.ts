export type UserIdentityLike = {
  id?: string | null;
  userId?: string | null;
  name?: string | null;
  email?: string | null;
};

export type UserDisplayLines = {
  primary: string;
  secondary: string | null;
  email: string | null;
  hasName: boolean;
};

function normalizeText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function obfuscateEmail(email: string) {
  const trimmed = normalizeText(email);
  if (!trimmed) {
    return "";
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

export function getUserIdentifier(user: UserIdentityLike) {
  return normalizeText(user.userId) ?? normalizeText(user.id) ?? null;
}

export function getUserDisplayLines(
  user: UserIdentityLike,
  {
    showEmails = false,
    fallbackLabel = "Anonymous",
    showIdentifierWhenEmailPrimary = true,
  }: {
    showEmails?: boolean;
    fallbackLabel?: string;
    showIdentifierWhenEmailPrimary?: boolean;
  } = {},
): UserDisplayLines {
  const name = normalizeText(user.name);
  const email = normalizeText(user.email);
  const identifier = getUserIdentifier(user);

  if (name) {
    return {
      primary: name,
      secondary: showEmails && email && email !== name ? email : null,
      email,
      hasName: true,
    };
  }

  if (email) {
    return {
      primary: showEmails ? email : obfuscateEmail(email),
      secondary: showIdentifierWhenEmailPrimary ? identifier : null,
      email,
      hasName: false,
    };
  }

  return {
    primary: identifier ?? fallbackLabel,
    secondary: null,
    email: null,
    hasName: false,
  };
}

export function getUserPrimaryLabel(
  user: UserIdentityLike,
  options?: Parameters<typeof getUserDisplayLines>[1],
) {
  return getUserDisplayLines(user, options).primary;
}

export function buildUserSearchText(
  user: UserIdentityLike,
  extraTerms: Array<string | null | undefined> = [],
) {
  return [
    user.name,
    user.email,
    getUserIdentifier(user),
    ...extraTerms,
  ]
    .map((value) => normalizeText(value))
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();
}
