import { NextResponse } from "next/server";
import { db } from "../../lib/firebaseAdmin";

// GET - Fetch all conversations for a user
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const search = searchParams.get('search') || '';

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    // Get all conversations for the user (without ordering to avoid index requirement)
    const snapshot = await db.collection('conversations')
      .where('userId', '==', userId)
      .get();
    
    let conversations = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      conversations.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
        updatedAt: data.updatedAt?.toDate?.() || new Date(data.updatedAt)
      });
    });

    // Sort by updatedAt in JavaScript (to avoid Firestore index requirement)
    conversations.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    // Filter by search term if provided
    if (search) {
      conversations = conversations.filter(conv => 
        conv.title.toLowerCase().includes(search.toLowerCase()) ||
        conv.messages.some(msg => 
          msg.content.toLowerCase().includes(search.toLowerCase())
        )
      );
    }

    return NextResponse.json({ 
      success: true, 
      conversations 
    });

  } catch (error) {
    console.error("Error fetching conversations:", error);
    return NextResponse.json({ 
      error: "Failed to fetch conversations" 
    }, { status: 500 });
  }
}

// POST - Create a new conversation
export async function POST(req) {
  try {
    const { userId, title, messages, source } = await req.json();

    if (!userId || !messages || !Array.isArray(messages)) {
      return NextResponse.json({ 
        error: "User ID and messages are required" 
      }, { status: 400 });
    }

    // Auto-generate title from first user message if not provided
    let conversationTitle = title;
    if (!conversationTitle) {
      const firstUserMessage = messages.find(msg => msg.role === 'user');
      if (firstUserMessage) {
        conversationTitle = firstUserMessage.content.slice(0, 50);
        if (firstUserMessage.content.length > 50) {
          conversationTitle += '...';
        }
      } else {
        conversationTitle = 'New Conversation';
      }
    }

    const conversationData = {
      userId,
      title: conversationTitle,
      messages,
      messageCount: messages.length,
      source: source || 'main-chatbot', // Default to main-chatbot for backward compatibility
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {
        lastActivity: new Date(),
        tags: []
      }
    };

    const docRef = await db.collection('conversations').add(conversationData);

    return NextResponse.json({ 
      success: true, 
      conversationId: docRef.id,
      conversation: {
        id: docRef.id,
        ...conversationData
      }
    });

  } catch (error) {
    console.error("Error creating conversation:", error);
    return NextResponse.json({ 
      error: "Failed to create conversation" 
    }, { status: 500 });
  }
}
