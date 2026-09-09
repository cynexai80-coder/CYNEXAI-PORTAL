function cleanText(text) {
    if (!text) return '';
    let cleaned = text;
    cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '');
    cleaned = cleaned.replace(/<think>[\s\S]*/gi, '');
    cleaned = cleaned.replace(/\*\*.*?\*\*/g, '');
    return cleaned.trim();
}

async function generateInitialQuestionVoice(context, voiceId, groqKey, deepgramKey, mocks = null) {
    if (groqKey === undefined) groqKey = process.env.GROQ_VOICE_API || process.env.GROQ_API_KEY;
    if (deepgramKey === undefined) deepgramKey = process.env.DEEPGRAM_VOICE_API || process.env.VITE_DEEPGRAM_VOICE_API;
    if (!groqKey || !deepgramKey) throw new Error("Missing API keys");

    if (mocks) {
        return await mocks.mockDeepgram();
    }

    // 1. Groq LLM (Generate Intro)
    const systemPrompt = `You are a professional corporate interviewer conducting a mock interview with a student.
Context about the student: ${context}
Start the interview by introducing yourself briefly, acknowledging their background, and asking them to introduce themselves.
Keep it under 3 sentences. Be welcoming but professional.`;

    let aiText = '';
    const candidateModels = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'qwen/qwen3.6-27b', 'groq/compound'];
    let lastLlmErr = '';

    for (const model of candidateModels) {
        try {
            const llmRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${groqKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model,
                    messages: [{ role: 'system', content: systemPrompt }]
                })
            });

            if (llmRes.ok) {
                const llmData = await llmRes.json();
                let rawText = llmData.choices?.[0]?.message?.content || '';
                aiText = cleanText(rawText);
                if (aiText) break;
            } else {
                lastLlmErr = await llmRes.text();
            }
        } catch (e) {
            lastLlmErr = e.message || String(e);
        }
    }

    if (!aiText) aiText = 'Hello, welcome to your mock interview. Let us begin.';

    // 2. Deepgram TTS
    const ttsRes = await fetch(`https://api.deepgram.com/v1/speak?model=${voiceId}`, {
        method: 'POST',
        headers: {
            'Authorization': `Token ${deepgramKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text: aiText })
    });

    if (!ttsRes.ok) throw new Error(`Deepgram TTS error: ${await ttsRes.text()}`);
    const arrayBuffer = await ttsRes.arrayBuffer();
    
    return {
        audioBuffer: Buffer.from(arrayBuffer),
        aiText
    };
}

async function processVoiceTurn(audioBuffer, chatHistoryText, context, turnCount, voiceId, groqKey, deepgramKey, mocks = null) {
    if (groqKey === undefined) groqKey = process.env.GROQ_VOICE_API || process.env.GROQ_API_KEY;
    if (deepgramKey === undefined) deepgramKey = process.env.DEEPGRAM_VOICE_API || process.env.VITE_DEEPGRAM_VOICE_API;
    if (!groqKey || !deepgramKey) {
        throw new Error("Missing API keys for voice processing");
    }

    try {
        let studentText = '';
        let aiText = '';
        let audioResponseBuffer = null;
        let chatHistory = [];
        try {
            if (chatHistoryText) chatHistory = JSON.parse(chatHistoryText);
        } catch(e) {
            console.error("Failed to parse chatHistory", e);
        }

        if (mocks) {
            studentText = await mocks.mockGroqTranscribe();
            aiText = await mocks.mockGroqChat();
            audioResponseBuffer = await mocks.mockDeepgram();
        } else {
            // 1. Groq Whisper (STT)
            const audioBlob = new Blob([audioBuffer], { type: 'audio/webm' });
            const form = new FormData();
            form.append('file', audioBlob, 'audio.webm');
            form.append('model', 'whisper-large-v3');

            const sttRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${groqKey}`
                },
                body: form
            });

            if (!sttRes.ok) throw new Error(`Groq STT error: ${await sttRes.text()}`);
            const sttData = await sttRes.json();
            studentText = sttData.text || '';

            // 2. Groq Llama (LLM)
            const systemPrompt = `You are a professional corporate interviewer. You are interviewing a student.
Context about the student: ${context}
This is turn ${turnCount} of the interview (max ~10). 
Behave like a real human interviewer. If the user doesn't know an answer, gracefully move to another topic. Keep responses conversational and concise (1-3 sentences max).
If this is turn 10 or higher, conclude the interview by thanking the candidate for their time and do NOT ask any further questions.`;
            
            const messages = [
                { role: 'system', content: systemPrompt },
                ...chatHistory.map(msg => ({
                    role: msg.role === 'ai' ? 'assistant' : 'user',
                    content: msg.content
                })),
                { role: 'user', content: studentText }
            ];

            const candidateModels = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'qwen/qwen3.6-27b', 'groq/compound'];
            let lastLlmErr = '';

            for (const model of candidateModels) {
                try {
                    const llmRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${groqKey}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            model,
                            messages: messages
                        })
                    });

                    if (llmRes.ok) {
                        const llmData = await llmRes.json();
                        let rawText = llmData.choices?.[0]?.message?.content || '';
                        aiText = cleanText(rawText);
                        if (aiText) break;
                    } else {
                        lastLlmErr = await llmRes.text();
                    }
                } catch (e) {
                    lastLlmErr = e.message || String(e);
                }
            }

            if (!aiText) aiText = 'Thank you for your answer.';

            // 3. Deepgram Aura (TTS)
            const ttsRes = await fetch(`https://api.deepgram.com/v1/speak?model=${voiceId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Token ${deepgramKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ text: aiText })
            });

            if (!ttsRes.ok) throw new Error(`Deepgram TTS error: ${await ttsRes.text()}`);
            const arrayBuffer = await ttsRes.arrayBuffer();
            audioResponseBuffer = Buffer.from(arrayBuffer);
        }

        return {
            transcript: studentText,
            aiResponse: aiText,
            audioBuffer: audioResponseBuffer
        };

    } catch (error) {
        console.error("Voice processing error:", error);
        throw error;
    }
}

module.exports = { processVoiceTurn, generateInitialQuestionVoice };
