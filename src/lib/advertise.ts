export const ADVERTISE_EMAIL = "loopgramchannel@gmail.com";
export const ADVERTISE_SUBJECT = "Advertising Inquiry — LoopgramChannel";
export const ADVERTISE_BODY = "Hello LoopgramChannel,\n\nI would like to advertise my business.\n\nBusiness name:\nWhat we offer:\nPhone / WhatsApp:\n\nThank you.";
export const advertiseMailto = () =>
  `mailto:${ADVERTISE_EMAIL}?subject=${encodeURIComponent(ADVERTISE_SUBJECT)}&body=${encodeURIComponent(ADVERTISE_BODY)}`;
