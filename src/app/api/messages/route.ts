import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { z } from "zod";
import { logError } from "@/lib/logger";

const sendSchema = z.object({
  conversationId: z.string().optional(),
  recipientId: z.string().optional(),
  ciphertext: z.string().min(1, "Message cannot be empty").max(131072, "Message too large"),
  nonce: z.string().min(16).max(64),
  messageIndex: z.number().int().min(0).max(2147483647),
  myEncryptedSessionKey: z.string().max(4096).optional(),
  theirEncryptedSessionKey: z.string().max(4096).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const conversationId = request.nextUrl.searchParams.get("conversationId");
    const cursor = request.nextUrl.searchParams.get("cursor");
    const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") || 50), 100);

    if (conversationId) {
      const member = await prisma.conversationMember.findUnique({
        where: { conversationId_userId: { conversationId, userId: session.userId } },
      });
      if (!member) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

      const messages = await prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: "desc" },
        take: limit,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        include: { sender: { select: { id: true, displayName: true, avatarUrl: true } } },
      });

      return NextResponse.json({ success: true, data: messages });
    }

    const conversations = await prisma.conversationMember.findMany({
      where: { userId: session.userId },
      include: {
        conversation: {
          include: {
            members: { include: { user: { select: { id: true, displayName: true, avatarUrl: true, publicIdentityKey: true } } } },
            messages: { orderBy: { createdAt: "desc" }, take: 1 },
          },
        },
      },
      orderBy: { conversation: { createdAt: "desc" } },
    });

    return NextResponse.json({ success: true, data: conversations });
  } catch (error) {
    logError("Messages_GET", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const validation = sendSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ success: false, error: validation.error.flatten().fieldErrors }, { status: 400 });
    }

    const { ciphertext, nonce, messageIndex, recipientId, myEncryptedSessionKey, theirEncryptedSessionKey } = validation.data;
    let { conversationId } = validation.data;

    if (!conversationId && recipientId) {
      const existing = await prisma.conversation.findFirst({
        where: {
          members: {
            every: { userId: { in: [session.userId, recipientId] } },
          },
        },
        include: { members: true },
      });

      if (existing && existing.members.length === 2) {
        conversationId = existing.id;
      } else {
        const conv = await prisma.conversation.create({
          data: {
            members: {
              create: [
                { userId: session.userId, encryptedSessionKey: myEncryptedSessionKey },
                { userId: recipientId, encryptedSessionKey: theirEncryptedSessionKey }
              ],
            },
          },
        });
        conversationId = conv.id;
      }
    }

    if (!conversationId) {
      return NextResponse.json({ success: false, error: "Conversation or recipient required" }, { status: 400 });
    }

    const member = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId: session.userId } },
    });
    if (!member) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

    const message = await prisma.message.create({
      data: { conversationId, senderId: session.userId, ciphertext, nonce, messageIndex },
      include: { sender: { select: { id: true, displayName: true, avatarUrl: true } } },
    });

    return NextResponse.json({ success: true, data: message }, { status: 201 });
  } catch (error) {
    logError("Messages_POST", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
