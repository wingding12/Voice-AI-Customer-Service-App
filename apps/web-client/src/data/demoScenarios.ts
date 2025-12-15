/**
 * Demo Scenarios with Pre-made Transcripts
 * 
 * These scenarios provide realistic starting points for demonstrating
 * the AI customer service platform capabilities.
 */

export interface TranscriptEntry {
  role: 'user' | 'agent';
  content: string;
}

export interface DemoScenario {
  id: string;
  label: string;
  icon: string;
  description: string;
  transcript: TranscriptEntry[];
  // Context for the AI to continue the conversation
  aiContext: string;
}

export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: 'high-bill',
    label: 'High Bill Dispute',
    icon: '💰',
    description: 'Customer disputing an unusually high electricity bill',
    transcript: [
      { role: 'agent', content: "Thank you for calling PowerGrid Energy Services. I'm your AI assistant. How can I help you today?" },
      { role: 'user', content: "Yeah, I just got my bill and it's $450! That's almost three times what I normally pay. This has to be a mistake." },
      { role: 'agent', content: "I completely understand your concern about the $450 bill - that's definitely higher than you'd expect. Let me help you figure out what's going on. Can you tell me roughly what your bill usually is?" },
      { role: 'user', content: "It's usually around $150, maybe $160 in the summer. But $450? That's insane. Nothing has changed in my house." },
      { role: 'agent', content: "A jump from $150 to $450 is significant, and I want to help you get to the bottom of this. There are a few common causes for spikes like this - it could be an estimated vs actual meter read, a rate change, or sometimes an appliance issue. When did you receive this bill?" },
      { role: 'user', content: "I got it yesterday. It's for last month. And I was actually out of town for two weeks!" },
    ],
    aiContext: `SCENARIO CONTEXT: You are mid-conversation with a customer about a $450 bill (normally $150). They were out of town for 2 weeks last month, which makes the high bill even more suspicious. 

KEY POINTS ALREADY DISCUSSED:
- Bill is $450 vs normal $150-160
- Customer was away for 2 weeks
- Nothing has changed in their home

NEXT STEPS TO OFFER:
1. Check if it was an estimated read vs actual read
2. Suggest reviewing the daily usage breakdown in their online account
3. Offer to arrange a free meter test if needed
4. Mention the high bill investigation process
5. If they're frustrated, offer to set up a payment arrangement while investigating

Continue the conversation naturally from here.`
  },
  {
    id: 'gas-leak',
    label: 'Gas Leak Emergency',
    icon: '🚨',
    description: 'Customer reporting a potential gas leak',
    transcript: [
      { role: 'agent', content: "Thank you for calling PowerGrid Energy Services. I'm your AI assistant. How can I help you today?" },
      { role: 'user', content: "I smell gas in my house! There's a strong rotten egg smell coming from my kitchen." },
      { role: 'agent', content: "I need you to stop and listen carefully - this could be a gas leak emergency. Are you still inside the house right now?" },
      { role: 'user', content: "Yes, I'm in the living room. Should I be worried?" },
      { role: 'agent', content: "Yes, please take this seriously. I need you to leave the house immediately. Don't turn on or off any light switches, don't use your phone inside, and don't start any cars in the garage. Just walk outside calmly right now. Are you able to do that?" },
      { role: 'user', content: "Okay, I'm heading to the front door now... Okay, I'm outside on the sidewalk." },
      { role: 'agent', content: "Good, you did the right thing. You're safe now. Stay outside and away from the house. I'm going to help you report this so we can send an emergency crew. First, is anyone else still inside the home?" },
      { role: 'user', content: "No, I live alone. My cat is outside with me too." },
    ],
    aiContext: `SCENARIO CONTEXT: This is a GAS LEAK EMERGENCY. The customer smelled gas (rotten eggs) in their kitchen and has safely evacuated to the sidewalk with their cat. They live alone.

CRITICAL ACTIONS COMPLETED:
- Customer has evacuated the home
- No one else is inside
- Pet is safe

NEXT STEPS:
1. Have them call 911 from their current location (or offer to stay on line while they do)
2. Provide the gas emergency hotline: 1-800-GAS-LEAK
3. Confirm their address for emergency dispatch
4. Advise them to stay at least 100 feet from the house
5. Tell them NOT to re-enter until cleared by emergency responders
6. Reassure them that there's no charge for gas leak investigations

This is still an active emergency - maintain urgency but stay calm.`
  },
  {
    id: 'new-service',
    label: 'New Service Setup',
    icon: '🏠',
    description: 'Customer setting up service at a new address',
    transcript: [
      { role: 'agent', content: "Thank you for calling PowerGrid Energy Services. I'm your AI assistant. How can I help you today?" },
      { role: 'user', content: "Hi, I'm moving to a new apartment next week and need to set up electricity and gas service." },
      { role: 'agent', content: "Congratulations on your move! I'd be happy to help you set up service at your new place. When is your move-in date?" },
      { role: 'user', content: "I'm moving in on Saturday the 21st. I get the keys at 10am." },
      { role: 'agent', content: "Perfect, Saturday the 21st. We can definitely have your service ready by then. What's the address of your new apartment?" },
      { role: 'user', content: "It's 742 Evergreen Terrace, Apartment 4B." },
      { role: 'agent', content: "Got it - 742 Evergreen Terrace, Apartment 4B. I can see that address in our system. The previous tenant's service ended last week, so we'll just need to transfer it to your name. Do you need both electric and gas service?" },
      { role: 'user', content: "Yes, both please. The apartment has a gas stove and heating." },
    ],
    aiContext: `SCENARIO CONTEXT: Customer is setting up new utility service for a move.

DETAILS COLLECTED:
- Move-in date: Saturday the 21st at 10am
- Address: 742 Evergreen Terrace, Apartment 4B
- Services needed: Both electric AND gas
- Previous tenant already moved out

NEXT STEPS TO DISCUSS:
1. Explain the connection fee ($35 standard, $75 same-day/next-day)
2. Ask if they've had service with PowerGrid before (may have deposit on file)
3. If new customer: explain deposit requirement ($200 or waived with good credit)
4. Offer autopay enrollment ($2/month discount)
5. Confirm start date and time preference
6. Ask for contact phone number and email for the account
7. Explain they'll receive a confirmation email

Continue helping them complete the enrollment naturally.`
  }
];

/**
 * Get a scenario by ID
 */
export function getScenarioById(id: string): DemoScenario | undefined {
  return DEMO_SCENARIOS.find(s => s.id === id);
}

/**
 * Convert scenario transcript to backend format
 */
export function transcriptToBackendFormat(transcript: TranscriptEntry[]): Array<{
  speaker: 'AI' | 'CUSTOMER';
  text: string;
  timestamp: number;
}> {
  const baseTime = Date.now() - (transcript.length * 5000); // 5 seconds apart
  return transcript.map((entry, index) => ({
    speaker: entry.role === 'agent' ? 'AI' : 'CUSTOMER',
    text: entry.content,
    timestamp: baseTime + (index * 5000),
  }));
}

