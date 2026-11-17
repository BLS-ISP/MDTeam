export const FQDN_REGEX =
  /^(?=.{1,253}$)(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}$/;

export function buildUserDomainOptions({
  noDomainLabel,
  clusterDomains,
  fallbackDomains,
  currentDomain,
}) {
  const seen = new Set();
  const list = [
    {
      name: "no_user_domain",
      label: noDomainLabel,
      value: "-",
    },
  ];
  for (const item of clusterDomains || []) {
    if (item && item.name && !seen.has(item.name)) {
      seen.add(item.name);
      const schemaLabel =
        item.schema === "ad"
          ? "Active Directory"
          : item.schema === "rfc2307"
          ? "OpenLDAP"
          : "";
      list.push({
        name: item.name,
        label: schemaLabel ? `${item.name} (${schemaLabel})` : item.name,
        value: item.name,
      });
    }
  }
  for (const name of fallbackDomains || []) {
    if (typeof name === "string" && name && !seen.has(name)) {
      seen.add(name);
      list.push({ name, label: name, value: name });
    }
  }
  if (currentDomain && currentDomain !== "-" && !seen.has(currentDomain)) {
    list.push({
      name: currentDomain,
      label: currentDomain,
      value: currentDomain,
    });
  }
  return list;
}
