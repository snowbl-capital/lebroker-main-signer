/** The hosts plain http is allowed to: this machine only. The session cookie and Main's signatures cross the wire. */
const LOOPBACK_HOSTNAMES: readonly string[] = ["localhost", "[::1]"]

/** 127.0.0.0/8, written as an address. */
const LOOPBACK_IPV4 = /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/

const HTTP_PROTOCOL = "http:"
const HTTPS_PROTOCOL = "https:"

const LABEL_SEPARATOR = ","

export { HTTP_PROTOCOL, HTTPS_PROTOCOL, LABEL_SEPARATOR, LOOPBACK_HOSTNAMES, LOOPBACK_IPV4 }
