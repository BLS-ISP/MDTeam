export const BER_TAGS = {
  BOOLEAN: 0x01, INTEGER: 0x02, OCTET_STRING: 0x04, NULL: 0x05, ENUMERATED: 0x0a,
  SEQUENCE: 0x30, SET: 0x31, BIND_REQUEST: 0x60, BIND_RESPONSE: 0x61, UNBIND_REQUEST: 0x42,
  SEARCH_REQUEST: 0x63, SEARCH_RESULT_ENTRY: 0x64, SEARCH_RESULT_DONE: 0x65, SEARCH_RESULT_REF: 0x73,
  SIMPLE_AUTH: 0x80, FILTER_AND: 0xa0, FILTER_OR: 0xa1, FILTER_EQUALITY: 0xa3, FILTER_PRESENT: 0x87,
} as const;

export interface BerElement {
  tag: number;
  tagClass: "universal" | "application" | "context" | "private";
  constructed: boolean;
  tagNumber: number;
  length: number;
  value: Buffer;
  totalLength: number;
}

export type LdapFilter =
  | { type: "equality"; attribute: string; value: string }
  | { type: "present"; attribute: string }
  | { type: "or"; filters: LdapFilter[] }
  | { type: "and"; filters: LdapFilter[] };

export interface LdapSearchRequestParams {
  messageId: number;
  baseDn: string;
  scope?: 0 | 1 | 2;
  derefAliases?: 0 | 1 | 2 | 3;
  sizeLimit?: number;
  timeLimit?: number;
  typesOnly?: boolean;
  filter: LdapFilter;
  attributes: string[];
}

export type DecodedLdapMessage =
  | { messageId: number; op: "BindRequest"; version: number; dn: string; password: string }
  | { messageId: number; op: "BindResponse"; resultCode: number; matchedDn: string; diagnosticMessage: string }
  | { messageId: number; op: "UnbindRequest" }
  | { messageId: number; op: "SearchRequest"; baseDn: string; scope: number; filter: LdapFilter; attributes: string[] }
  | { messageId: number; op: "SearchResultEntry"; dn: string; attributes: Record<string, string[]> }
  | { messageId: number; op: "SearchResultDone"; resultCode: number; matchedDn: string; diagnosticMessage: string }
  | { messageId: number; op: "Unknown"; tag: number };

export function encodeBerLength(length: number): Buffer {
  if (!Number.isInteger(length) || length < 0) throw new Error(`Invalid BER length: ${length}`);
  if (length < 0x80) return Buffer.from([length]);
  const bytes: number[] = [];
  for (let rem = length; rem > 0; rem = Math.floor(rem / 256)) bytes.unshift(rem & 0xff);
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}

export function encodeBerTlv(tag: number, content: Buffer): Buffer {
  return Buffer.concat([Buffer.from([tag]), encodeBerLength(content.length), content]);
}

export function encodeBoolean(value: boolean): Buffer {
  return encodeBerTlv(BER_TAGS.BOOLEAN, Buffer.from([value ? 0xff : 0x00]));
}

function encodeSignedIntBytes(value: number): Buffer {
  if (!Number.isInteger(value)) throw new Error(`Invalid BER integer: ${value}`);
  if (value === 0) return Buffer.from([0x00]);
  if (value > 0) {
    const bytes: number[] = [];
    for (let rem = value; rem > 0; rem = Math.floor(rem / 256)) bytes.unshift(rem & 0xff);
    if ((bytes[0] & 0x80) !== 0) bytes.unshift(0x00);
    return Buffer.from(bytes);
  }
  let bitLen = 8;
  while (value < -(2 ** (bitLen - 1))) bitLen += 8;
  const bytes: number[] = [];
  for (let i = 0, twos = 2 ** bitLen + value; i < bitLen / 8; i++, twos = Math.floor(twos / 256)) {
    bytes.unshift(twos & 0xff);
  }
  return Buffer.from(bytes);
}

export function encodeInteger(value: number): Buffer {
  return encodeBerTlv(BER_TAGS.INTEGER, encodeSignedIntBytes(value));
}

export function encodeEnumerated(value: number): Buffer {
  return encodeBerTlv(BER_TAGS.ENUMERATED, encodeSignedIntBytes(value));
}

export function encodeOctetString(value: string | Buffer): Buffer {
  return encodeBerTlv(BER_TAGS.OCTET_STRING, Buffer.isBuffer(value) ? value : Buffer.from(value, "utf8"));
}

export function encodeSequence(elements: Buffer[]): Buffer {
  return encodeBerTlv(BER_TAGS.SEQUENCE, Buffer.concat(elements));
}

export function encodeSet(elements: Buffer[]): Buffer {
  return encodeBerTlv(BER_TAGS.SET, Buffer.concat(elements));
}

export function readBerElement(buf: Buffer, offset = 0): BerElement | null {
  if (offset + 2 > buf.length) return null;
  const firstTag = buf[offset];
  const tagClass = (["universal", "application", "context", "private"] as const)[(firstTag >> 6) & 0x03];
  const constructed = (firstTag & 0x20) !== 0;
  let tagNumber = firstTag & 0x1f;
  let pos = offset + 1;
  if (tagNumber === 0x1f) {
    tagNumber = 0;
    while (true) {
      if (pos >= buf.length) return null;
      const b = buf[pos++];
      tagNumber = tagNumber * 128 + (b & 0x7f);
      if ((b & 0x80) === 0) break;
    }
  }
  if (pos >= buf.length) return null;
  const firstLen = buf[pos++];
  if (firstLen === 0x80) throw new Error("Indefinite BER length is prohibited in LDAPv3");
  let length = 0;
  if ((firstLen & 0x80) === 0) {
    length = firstLen;
  } else {
    const octets = firstLen & 0x7f;
    if (octets === 0 || octets > 4) throw new Error(`Unsupported BER length octets: ${octets}`);
    if (pos + octets > buf.length) return null;
    for (let i = 0; i < octets; i++) length = length * 256 + buf[pos++];
  }
  if (pos + length > buf.length) return null;
  return {
    tag: firstTag, tagClass, constructed, tagNumber, length,
    value: buf.subarray(pos, pos + length),
    totalLength: pos + length - offset,
  };
}

export function readBerChildren(content: Buffer): BerElement[] {
  const items: BerElement[] = [];
  for (let offset = 0; offset < content.length; ) {
    const el = readBerElement(content, offset);
    if (!el) throw new Error("Truncated nested BER element");
    items.push(el);
    offset += el.totalLength;
  }
  return items;
}

export function decodeInteger(value: Buffer): number {
  if (value.length === 0) return 0;
  let result = (value[0] & 0x80) !== 0 ? value[0] - 256 : value[0];
  for (let i = 1; i < value.length; i++) result = result * 256 + value[i];
  return result;
}

export function decodeBoolean(value: Buffer): boolean {
  return value.length > 0 && value[0] !== 0x00;
}

export function encodeFilter(filter: LdapFilter): Buffer {
  if (filter.type === "present") return encodeBerTlv(BER_TAGS.FILTER_PRESENT, Buffer.from(filter.attribute, "utf8"));
  if (filter.type === "equality") {
    return encodeBerTlv(
      BER_TAGS.FILTER_EQUALITY,
      Buffer.concat([encodeOctetString(filter.attribute), encodeOctetString(filter.value)])
    );
  }
  const tag = filter.type === "and" ? BER_TAGS.FILTER_AND : BER_TAGS.FILTER_OR;
  return encodeBerTlv(tag, Buffer.concat(filter.filters.map(encodeFilter)));
}

export function decodeFilter(el: BerElement): LdapFilter {
  if (el.tag === BER_TAGS.FILTER_PRESENT) return { type: "present", attribute: el.value.toString("utf8") };
  if (el.tag === BER_TAGS.FILTER_EQUALITY) {
    const parts = readBerChildren(el.value);
    return {
      type: "equality",
      attribute: (parts[0]?.value || Buffer.alloc(0)).toString("utf8"),
      value: (parts[1]?.value || Buffer.alloc(0)).toString("utf8"),
    };
  }
  if (el.tag === BER_TAGS.FILTER_AND || el.tag === BER_TAGS.FILTER_OR) {
    return { type: el.tag === BER_TAGS.FILTER_AND ? "and" : "or", filters: readBerChildren(el.value).map(decodeFilter) };
  }
  throw new Error(`Unsupported LDAP filter tag: 0x${el.tag.toString(16)}`);
}

export function encodeBindRequest(messageId: number, bindDn: string, password: string): Buffer {
  const auth = encodeBerTlv(BER_TAGS.SIMPLE_AUTH, Buffer.from(password, "utf8"));
  const op = encodeBerTlv(BER_TAGS.BIND_REQUEST, Buffer.concat([encodeInteger(3), encodeOctetString(bindDn), auth]));
  return encodeSequence([encodeInteger(messageId), op]);
}

export function encodeBindResponse(messageId: number, resultCode: number, matchedDn = "", diagnosticMessage = ""): Buffer {
  const body = Buffer.concat([encodeEnumerated(resultCode), encodeOctetString(matchedDn), encodeOctetString(diagnosticMessage)]);
  return encodeSequence([encodeInteger(messageId), encodeBerTlv(BER_TAGS.BIND_RESPONSE, body)]);
}

export function encodeUnbindRequest(messageId: number): Buffer {
  return encodeSequence([encodeInteger(messageId), encodeBerTlv(BER_TAGS.UNBIND_REQUEST, Buffer.alloc(0))]);
}

export function encodeSearchRequest(params: LdapSearchRequestParams): Buffer {
  const op = encodeBerTlv(
    BER_TAGS.SEARCH_REQUEST,
    Buffer.concat([
      encodeOctetString(params.baseDn),
      encodeEnumerated(params.scope ?? 2),
      encodeEnumerated(params.derefAliases ?? 0),
      encodeInteger(params.sizeLimit ?? 50),
      encodeInteger(params.timeLimit ?? 5),
      encodeBoolean(params.typesOnly ?? false),
      encodeFilter(params.filter),
      encodeSequence(params.attributes.map(encodeOctetString)),
    ])
  );
  return encodeSequence([encodeInteger(params.messageId), op]);
}

export function encodeSearchResultEntry(messageId: number, dn: string, attributes: Record<string, string[]>): Buffer {
  const attrSeq = Object.entries(attributes).map(([k, vals]) =>
    encodeSequence([encodeOctetString(k), encodeSet(vals.map(encodeOctetString))])
  );
  const op = encodeBerTlv(BER_TAGS.SEARCH_RESULT_ENTRY, Buffer.concat([encodeOctetString(dn), encodeSequence(attrSeq)]));
  return encodeSequence([encodeInteger(messageId), op]);
}

export function encodeSearchResultDone(messageId: number, resultCode: number, diagnosticMessage = ""): Buffer {
  const body = Buffer.concat([encodeEnumerated(resultCode), encodeOctetString(""), encodeOctetString(diagnosticMessage)]);
  return encodeSequence([encodeInteger(messageId), encodeBerTlv(BER_TAGS.SEARCH_RESULT_DONE, body)]);
}

export function decodeLdapMessage(envelope: BerElement): DecodedLdapMessage {
  if (envelope.tag !== BER_TAGS.SEQUENCE) throw new Error("LDAPMessage must be a BER SEQUENCE");
  const top = readBerChildren(envelope.value);
  if (top.length < 2) throw new Error("Malformed LDAPMessage");
  const messageId = decodeInteger(top[0].value);
  const opEl = top[1];
  const utf8 = (b?: Buffer) => (b || Buffer.alloc(0)).toString("utf8");
  if (opEl.tag === BER_TAGS.BIND_REQUEST) {
    const ch = readBerChildren(opEl.value);
    return { messageId, op: "BindRequest", version: decodeInteger(ch[0]?.value || Buffer.alloc(0)), dn: utf8(ch[1]?.value), password: utf8(ch[2]?.value) };
  }
  if (opEl.tag === BER_TAGS.BIND_RESPONSE || opEl.tag === BER_TAGS.SEARCH_RESULT_DONE) {
    const ch = readBerChildren(opEl.value);
    const op = opEl.tag === BER_TAGS.BIND_RESPONSE ? "BindResponse" : "SearchResultDone";
    return { messageId, op, resultCode: decodeInteger(ch[0]?.value || Buffer.alloc(0)), matchedDn: utf8(ch[1]?.value), diagnosticMessage: utf8(ch[2]?.value) };
  }
  if (opEl.tag === BER_TAGS.UNBIND_REQUEST) return { messageId, op: "UnbindRequest" };
  if (opEl.tag === BER_TAGS.SEARCH_REQUEST) {
    const ch = readBerChildren(opEl.value);
    const attributes = readBerChildren(ch[7].value).map((a) => utf8(a.value));
    return { messageId, op: "SearchRequest", baseDn: utf8(ch[0].value), scope: decodeInteger(ch[1].value), filter: decodeFilter(ch[6]), attributes };
  }
  if (opEl.tag === BER_TAGS.SEARCH_RESULT_ENTRY) {
    const ch = readBerChildren(opEl.value);
    const attributes: Record<string, string[]> = {};
    for (const part of readBerChildren(ch[1]?.value || Buffer.alloc(0))) {
      const kv = readBerChildren(part.value);
      attributes[utf8(kv[0]?.value)] = readBerChildren(kv[1]?.value || Buffer.alloc(0)).map((v) => utf8(v.value));
    }
    return { messageId, op: "SearchResultEntry", dn: utf8(ch[0].value), attributes };
  }
  return { messageId, op: "Unknown", tag: opEl.tag };
}
