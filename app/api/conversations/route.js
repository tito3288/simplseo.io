import { NextResponse } from "next/server";
import { db } from "../../lib/firebaseAdmin";
import { saveConversationSummary } from "../../lib/conversationSummarizer";

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
    const firstUserMessage = messages.find(msg => msg.role === 'user');
    if (!conversationTitle && firstUserMessage) {
      conversationTitle = firstUserMessage.content.slice(0, 50);
      if (firstUserMessage.content.length > 50) {
        conversationTitle += '...';
      }
    } else if (!conversationTitle) {
      conversationTitle = 'New Conversation';
    }

    // Deduplication: Check if a conversation with the same first message was created recently (within 5 minutes)
    // This prevents duplicate conversations from race conditions
    if (firstUserMessage) {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const existingSnapshot = await db.collection('conversations')
        .where('userId', '==', userId)
        .where('source', '==', source || 'main-chatbot')
        .where('createdAt', '>=', fiveMinutesAgo)
        .get();

      // Check if any existing conversation has the same first user message
      for (const doc of existingSnapshot.docs) {
        const existingData = doc.data();
        const existingFirstUserMsg = existingData.messages?.find(msg => msg.role === 'user');
        
        if (existingFirstUserMsg && 
            existingFirstUserMsg.content === firstUserMessage.content &&
            existingData.messageCount === messages.length) {
          // Found duplicate - return existing conversation ID instead of creating new one
          return NextResponse.json({ 
            success: true, 
            conversationId: doc.id,
            conversation: {
              id: doc.id,
              ...existingData,
              createdAt: existingData.createdAt?.toDate?.() || new Date(existingData.createdAt),
              updatedAt: existingData.updatedAt?.toDate?.() || new Date(existingData.updatedAt)
            },
            isDuplicate: true
          });
        }
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

    // Save conversation summary for training (async, don't block response)
    try {
      // Get user's onboarding data for business context
      const onboardingDoc = await db.collection('onboarding').doc(userId).get();
      const onboarding = onboardingDoc.exists ? onboardingDoc.data() : {};
      
      saveConversationSummary(userId, {
        messages,
        businessType: onboarding.businessType,
        businessLocation: onboarding.businessLocation,
        source: source || 'main-chatbot',
      }).catch(err => {
        console.error("Failed to save conversation summary (non-critical):", err);
      });
    } catch (err) {
      // Non-critical - don't fail the request
      console.error("Error saving conversation summary:", err);
    }

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
