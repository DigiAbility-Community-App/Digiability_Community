import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const CHAT_SVC_URL = process.env.CHAT_SVC_URL || "http://187.127.191.28:30502";
const FORUM_SVC_URL = process.env.FORUM_SVC_URL || "http://187.127.191.28:30503";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: pathSegments } = await params;
  const filename = pathSegments.join("/");

  // 1. Try local disk paths first if available
  const localPaths = [
    path.join(process.cwd(), "../../services/chat-svc/uploads", filename),
    path.join(process.cwd(), "../../services/forum-svc/uploads", filename),
    path.join(process.cwd(), "../services/chat-svc/uploads", filename),
    path.join(process.cwd(), "../services/forum-svc/uploads", filename),
  ];

  for (const localPath of localPaths) {
    if (fs.existsSync(localPath)) {
      const fileBuffer = fs.readFileSync(localPath);
      const ext = path.extname(filename).toLowerCase();
      const contentType =
        ext === ".jpg" || ext === ".jpeg"
          ? "image/jpeg"
          : ext === ".png"
          ? "image/png"
          : ext === ".webp"
          ? "image/webp"
          : ext === ".gif"
          ? "image/gif"
          : "application/octet-stream";

      return new NextResponse(fileBuffer, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=86400",
        },
      });
    }
  }

  // 2. Try proxying from CHAT_SVC_URL
  try {
    const chatRes = await fetch(`${CHAT_SVC_URL}/uploads/${filename}`);
    if (chatRes.ok) {
      const arrayBuffer = await chatRes.arrayBuffer();
      const contentType = chatRes.headers.get("content-type") || "image/jpeg";
      return new NextResponse(arrayBuffer, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=86400",
        },
      });
    }
  } catch {}

  // 3. Try proxying from FORUM_SVC_URL
  try {
    const forumRes = await fetch(`${FORUM_SVC_URL}/uploads/${filename}`);
    if (forumRes.ok) {
      const arrayBuffer = await forumRes.arrayBuffer();
      const contentType = forumRes.headers.get("content-type") || "image/jpeg";
      return new NextResponse(arrayBuffer, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=86400",
        },
      });
    }
  } catch {}

  return NextResponse.json({ error: "File not found" }, { status: 404 });
}
