import { NextResponse } from "next/server";
import { db } from "../../../lib/firebaseAdmin";

// GET - Fetch a specific conversation
export async function GET(req, { params }) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "Conversation ID is required" }, { status: 400 });
    }

    const doc = await db.collection('conversations').doc(id).get();

    if (!doc.exists) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const data = doc.data();
    const conversation = {
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
      updatedAt: data.updatedAt?.toDate?.() || new Date(data.updatedAt)
    };

    return NextResponse.json({ 
      success: true, 
      conversation 
    });

  } catch (error) {
    console.error("Error fetching conversation:", error);
    return NextResponse.json({ 
      error: "Failed to fetch conversation" 
    }, { status: 500 });
  }
}

// PUT - Update a conversation (rename, add messages, etc.)
export async function PUT(req, { params }) {
  try {
    const { id } = await params;
    const { title, messages, action, cornerEnded } = await req.json();

    if (!id) {
      return NextResponse.json({ error: "Conversation ID is required" }, { status: 400 });
    }

    const conversationRef = db.collection('conversations').doc(id);
    const doc = await conversationRef.get();

    if (!doc.exists) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    let updateData = {
      updatedAt: new Date()
    };

    if (action === 'rename' && title) {
      updateData.title = title;
    } else if (action === 'cornerEnd') {
      updateData.cornerEnded = cornerEnded || true;
    } else if (action === 'addMessage' && messages) {
      updateData.messages = messages;
      updateData.messageCount = messages.length;
      updateData.metadata = {
        ...doc.data().metadata,
        lastActivity: new Date()
      };
    }

    await conversationRef.update(updateData);

    // Fetch updated conversation
    const updatedDoc = await conversationRef.get();
    const data = updatedDoc.data();
    const conversation = {
      id: updatedDoc.id,
      ...data,
      createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
      updatedAt: data.updatedAt?.toDate?.() || new Date(data.updatedAt)
    };

    return NextResponse.json({ 
      success: true, 
      conversation 
    });

  } catch (error) {
    console.error("Error updating conversation:", error);
    return NextResponse.json({ 
      error: "Failed to update conversation" 
    }, { status: 500 });
  }
}

// DELETE - Delete a conversation
export async function DELETE(req, { params }) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "Conversation ID is required" }, { status: 400 });
    }

    const conversationRef = db.collection('conversations').doc(id);
    const doc = await conversationRef.get();

    if (!doc.exists) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    await conversationRef.delete();

    return NextResponse.json({ 
      success: true, 
      message: "Conversation deleted successfully" 
    });

  } catch (error) {
    console.error("Error deleting conversation:", error);
    return NextResponse.json({ 
      error: "Failed to delete conversation" 
    }, { status: 500 });
  }
}
