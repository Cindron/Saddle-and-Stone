import nodemailer from "nodemailer";
import { config } from "./config.js";

let transporter;

function mailEnabled() {
  const s = config.smtp;
  return Boolean(s.host && s.from && s.to);
}

function getTransporter() {
  if (!mailEnabled()) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: config.smtp.user ? {
        user: config.smtp.user,
        pass: config.smtp.pass
      } : undefined
    });
  }
  return transporter;
}

export async function sendInquiryNotification({ item, inquiry }) {
  const tx = getTransporter();
  if (!tx) return { sent: false, reason: "not-configured" };

  const subject = `Saddle & Stone inquiry — ${item.item_code || item.title}`;
  const contact = [
    inquiry.email ? `Email: ${inquiry.email}` : "",
    inquiry.phone ? `Phone: ${inquiry.phone}` : ""
  ].filter(Boolean).join("\n");

  const body = [
    "A customer asked about an item on Saddle & Stone.",
    "",
    `Item: ${item.title}`,
    `Reference: ${item.item_code || "—"}`,
    "",
    `Name: ${inquiry.name}`,
    contact,
    "",
    "Message:",
    inquiry.message || "(No message supplied.)",
    "",
    "This inquiry is also saved in the Owner Portal."
  ].filter(v => v !== "").join("\n");

  try {
    await tx.sendMail({
      from: config.smtp.from,
      to: config.smtp.to,
      replyTo: inquiry.email || undefined,
      subject,
      text: body
    });
    return { sent: true };
  } catch (error) {
    console.error("Inquiry email notification failed:", error.message);
    return { sent: false, reason: "send-failed" };
  }
}
