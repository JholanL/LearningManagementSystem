// Sample content for the demo. All companies here are fictional:
// "VoiceLink Solutions" (the BPO) and "Lumina Telecom" (the client account).

const users = {
  admin: { firstName: 'Andrea', lastName: 'Villanueva', email: 'admin@voicelink.ph', password: 'Admin@123', role: 'admin', employeeId: 'VL-0001' },
  trainers: [
    { firstName: 'Maria', lastName: 'Santos', email: 'maria.santos@voicelink.ph', password: 'Trainer@123', role: 'trainer', employeeId: 'VL-1001', phone: '09171234567' },
    { firstName: 'Paolo', lastName: 'Reyes', email: 'paolo.reyes@voicelink.ph', password: 'Trainer@123', role: 'trainer', employeeId: 'VL-1002' },
  ],
  // wave: which batch they belong to
  agents: [
    { firstName: 'Juan', lastName: 'Dela Cruz', email: 'juan.delacruz@voicelink.ph', employeeId: 'VL-2001', wave: 0 },
    { firstName: 'Bea', lastName: 'Gonzales', email: 'bea.gonzales@voicelink.ph', employeeId: 'VL-2002', wave: 0 },
    { firstName: 'Carlo', lastName: 'Mendoza', email: 'carlo.mendoza@voicelink.ph', employeeId: 'VL-2003', wave: 0 },
    { firstName: 'Diane', lastName: 'Ramos', email: 'diane.ramos@voicelink.ph', employeeId: 'VL-2004', wave: 0 },
    { firstName: 'Enzo', lastName: 'Bautista', email: 'enzo.bautista@voicelink.ph', employeeId: 'VL-2005', wave: 0 },
    { firstName: 'Faye', lastName: 'Aquino', email: 'faye.aquino@voicelink.ph', employeeId: 'VL-2006', wave: 0 },
    { firstName: 'Gino', lastName: 'Torres', email: 'gino.torres@voicelink.ph', employeeId: 'VL-2101', wave: 1 },
    { firstName: 'Hazel', lastName: 'Navarro', email: 'hazel.navarro@voicelink.ph', employeeId: 'VL-2102', wave: 1 },
    { firstName: 'Ivan', lastName: 'Castillo', email: 'ivan.castillo@voicelink.ph', employeeId: 'VL-2103', wave: 1 },
  ],
  agentPassword: 'Agent@123',
};

const courses = [
  {
    code: 'CSF-101',
    title: 'Customer Service Fundamentals',
    description:
      'The foundation of every great call: professional greetings, active listening, empathy statements, and proper call flow from opening to closing.',
    category: 'Soft Skills',
    level: 'Beginner',
    estimatedHours: 2,
    isPublished: true,
    lessons: [
      {
        title: 'The Standard Call Flow',
        durationMinutes: 15,
        content: `Every call follows the same five stages:

1. OPENING - Greet the customer, state the company name and your name.
   "Thank you for calling Lumina Telecom, this is Juan. How may I help you today?"
2. VERIFICATION - Confirm the caller is the account holder before discussing any account details.
3. PROBING - Ask open-ended questions to fully understand the issue.
4. RESOLUTION - Fix the issue or explain the next steps and timeframes clearly.
5. CLOSING - Recap what was done, offer further help, and thank the customer.

Skipping a stage is one of the most common reasons for low QA scores.`,
      },
      {
        title: 'Active Listening and Probing',
        durationMinutes: 20,
        content: `Active listening means focusing completely on the customer instead of preparing your reply.

Techniques:
- Paraphrase: "So if I understand correctly, your internet drops every evening around 8 PM?"
- Acknowledge: short verbal nods like "I see" and "I understand".
- Avoid interrupting, even if you already know the answer.

Probing questions:
- Open-ended: "Can you walk me through what happened?"
- Closed: "Did you restart the modem?" (use to confirm details)

Rule of thumb: start open, then narrow down with closed questions.`,
      },
      {
        title: 'Empathy Statements That Sound Sincere',
        durationMinutes: 15,
        content: `Empathy shows the customer you understand how they feel. It must sound natural, not scripted.

Good:
- "I understand how frustrating it is to be charged for something you didn't expect."
- "I'm sorry this has been happening for three days now. Let's get this fixed."

Avoid:
- "I understand your concern." (overused, sounds robotic)
- "Calm down." (never tell a customer how to feel)

Pair every empathy statement with an action: empathy + assurance + next step.`,
      },
    ],
    quiz: {
      title: 'Customer Service Fundamentals Assessment',
      timeLimitMinutes: 10,
      questions: [
        { question: 'What is the correct order of the standard call flow?', options: ['Opening, Probing, Verification, Closing, Resolution', 'Opening, Verification, Probing, Resolution, Closing', 'Verification, Opening, Resolution, Probing, Closing', 'Opening, Resolution, Verification, Probing, Closing'], correctAnswer: 1, explanation: 'Open, verify the caller, understand the issue, resolve it, then close.' },
        { question: 'Which is the best example of paraphrasing?', options: ['"Okay."', '"Please hold."', '"So your internet drops every evening around 8 PM, is that right?"', '"That is not possible."'], correctAnswer: 2, explanation: 'Paraphrasing restates the issue in your own words to confirm understanding.' },
        { question: 'Which empathy statement should be avoided?', options: ['"I\'m sorry this has been happening for three days."', '"Calm down, sir."', '"I understand how frustrating that must be."', '"Let\'s get this fixed for you."'], correctAnswer: 1, explanation: 'Never tell a customer how to feel; it escalates the call.' },
        { question: 'An open-ended probing question is best used to...', options: ['Confirm a yes/no detail', 'End the call quickly', 'Get the full story of the issue', 'Verify the account'], correctAnswer: 2, explanation: 'Open-ended questions let the customer explain the whole situation.' },
        { question: 'What should every closing include?', options: ['A recap, an offer of further help, and a thank you', 'Only "Goodbye"', 'A sales pitch', 'The customer\'s account number'], correctAnswer: 0, explanation: 'Recap + further assistance + thank you is the standard closing.' },
      ],
    },
  },
  {
    code: 'IRT-102',
    title: 'Handling Irate Customers',
    description: 'De-escalation techniques for angry callers, handling supervisor requests, and protecting your own well-being on difficult calls.',
    category: 'Soft Skills',
    level: 'Intermediate',
    estimatedHours: 2,
    isPublished: true,
    lessons: [
      {
        title: 'Why Customers Get Irate',
        durationMinutes: 10,
        content: `Most irate customers are not angry at YOU. They are angry at the situation: repeated issues, long hold times, or feeling unheard.

Common triggers:
- Calling multiple times about the same problem
- Being transferred repeatedly
- Unexpected charges
- Feeling that the agent is reading a script

Understanding the trigger helps you choose the right response.`,
      },
      {
        title: 'The LEAP De-escalation Technique',
        durationMinutes: 20,
        content: `LEAP is a simple de-escalation model:

L - LISTEN: Let the customer vent without interrupting.
E - EMPATHIZE: Acknowledge the feeling. "I can hear how upsetting this has been."
A - APOLOGIZE: Apologize for the experience, even if it isn't your fault.
P - PROBLEM-SOLVE: Take ownership. "Here's what I'm going to do for you right now."

Keep your tone calm and your pace slightly slower than the customer's.`,
      },
      {
        title: 'Handling Supervisor Requests',
        durationMinutes: 15,
        content: `When a customer asks for a supervisor:

1. Don't take it personally and don't transfer immediately.
2. Acknowledge and offer to help first: "I understand. Before I transfer you, may I try to resolve this for you right now?"
3. If they still insist, follow your account's escalation process and set expectations about wait time.
4. Never argue or say "my supervisor will say the same thing."

Many escalations are avoided when the agent shows ownership.`,
      },
    ],
    quiz: {
      title: 'De-escalation Assessment',
      timeLimitMinutes: 10,
      questions: [
        { question: 'What does the "A" in LEAP stand for?', options: ['Assess', 'Apologize', 'Assign', 'Argue'], correctAnswer: 1, explanation: 'Listen, Empathize, Apologize, Problem-solve.' },
        { question: 'A customer demands a supervisor. What is the best first response?', options: ['Transfer immediately', 'Tell them the supervisor is busy', 'Acknowledge and offer to resolve it first', 'Place them on hold without explaining'], correctAnswer: 2, explanation: 'Offer to help first; transfer only if they still insist.' },
        { question: 'While the customer is venting, you should...', options: ['Interrupt with the solution', 'Listen without interrupting', 'Mute the call', 'Ask them to call back later'], correctAnswer: 1, explanation: 'Letting customers vent is the "Listen" step of LEAP.' },
        { question: 'Which tone is best with an irate customer?', options: ['Fast and loud', 'Calm and slightly slower', 'Sarcastic', 'Monotone and scripted'], correctAnswer: 1, explanation: 'A calm, slightly slower pace helps lower the customer\'s intensity.' },
        { question: 'Most irate customers are angry at...', options: ['The agent personally', 'The situation they are in', 'The weather', 'Their family'], correctAnswer: 1, explanation: 'Separate the person from the problem; the anger is about the situation.' },
      ],
    },
  },
  {
    code: 'DPA-103',
    title: 'Data Privacy Act Compliance',
    description: 'Understanding RA 10173 (Data Privacy Act of 2012), proper caller verification, and how to handle personal information on every call.',
    category: 'Compliance',
    level: 'Beginner',
    estimatedHours: 1.5,
    isPublished: true,
    lessons: [
      {
        title: 'RA 10173 in the Contact Center',
        durationMinutes: 20,
        content: `The Data Privacy Act of 2012 (Republic Act No. 10173) protects personal information in the Philippines. It is enforced by the National Privacy Commission (NPC).

For agents, this means:
- Only access customer data needed for the current transaction.
- Never write customer information on paper or personal devices.
- Never share account details with anyone who is not verified as the account holder or an authorized person.
- Report any suspected data breach to your supervisor immediately.

Violations can lead to termination and legal liability.`,
      },
      {
        title: 'Caller Verification Procedure',
        durationMinutes: 15,
        content: `Before discussing ANY account detail, verify the caller.

Lumina Telecom verification (2-factor):
1. Account number or registered mobile number
2. PLUS any one of: birthdate, last payment amount, or registered email

If the caller fails verification:
- Do not confirm or deny any account information.
- Politely explain you can only discuss the account with the verified account holder.
- Offer general (non-account) information instead.`,
      },
    ],
    quiz: {
      title: 'Data Privacy Compliance Check',
      timeLimitMinutes: 8,
      questions: [
        { question: 'What law protects personal information in the Philippines?', options: ['RA 9165', 'RA 10173', 'RA 10175', 'RA 8792'], correctAnswer: 1, explanation: 'RA 10173 is the Data Privacy Act of 2012.' },
        { question: 'Which agency enforces the Data Privacy Act?', options: ['DICT', 'NTC', 'National Privacy Commission', 'DTI'], correctAnswer: 2, explanation: 'The National Privacy Commission (NPC) enforces RA 10173.' },
        { question: 'A caller cannot complete verification. You should...', options: ['Give the balance anyway', 'Confirm the account exists', 'Not disclose any account details', 'Ask for their password'], correctAnswer: 2, explanation: 'Unverified callers must not receive any account information.' },
        { question: 'Is it okay to write a customer\'s number on a sticky note?', options: ['Yes, if you throw it away later', 'No, never record customer data outside approved systems', 'Yes, during busy days', 'Only for VIP customers'], correctAnswer: 1, explanation: 'Customer data must stay inside approved systems.' },
      ],
    },
  },
  {
    code: 'LTP-201',
    title: 'Lumina Telecom Postpaid Plans',
    description: 'Product knowledge for the Lumina Telecom postpaid account: plan inclusions, add-ons, billing cycle, and common billing questions.',
    category: 'Product Knowledge',
    level: 'Intermediate',
    estimatedHours: 3,
    isPublished: true,
    lessons: [
      {
        title: 'Plan Lineup and Inclusions',
        durationMinutes: 25,
        content: `Lumina Postpaid plans (fictional account for training):

- LUMINA 599: 15 GB data, unlimited texts to all networks, 100 mins calls
- LUMINA 999: 40 GB data, unlimited calls and texts to all networks
- LUMINA 1499: 80 GB data, unlimited calls and texts, free 6-month streaming add-on

All plans have a 24-month lock-in period. Data does NOT roll over.
Upgrades take effect on the next billing cycle.`,
      },
      {
        title: 'Billing Cycle and Value-Added Services',
        durationMinutes: 20,
        content: `Billing cycle: bills are generated every 1st of the month and due on the 21st.

Value-Added Services (VAS) are optional paid subscriptions (streaming, games, horoscope texts). They can be activated by replying to promo texts, which is the #1 cause of "unknown charges" complaints.

Agents may:
- Deactivate VAS immediately
- File a one-time courtesy adjustment for unrecognized VAS charges (once every 12 months per account)
- Add a VAS block to prevent future subscriptions`,
      },
    ],
    quiz: {
      title: 'Postpaid Product Knowledge Test',
      timeLimitMinutes: 10,
      questions: [
        { question: 'Which plan includes a free 6-month streaming add-on?', options: ['LUMINA 599', 'LUMINA 999', 'LUMINA 1499', 'None'], correctAnswer: 2, explanation: 'Only LUMINA 1499 includes the streaming add-on.' },
        { question: 'When does a plan upgrade take effect?', options: ['Immediately', 'Next billing cycle', 'After 24 months', 'After 7 days'], correctAnswer: 1, explanation: 'Upgrades apply on the next billing cycle.' },
        { question: 'What is the #1 cause of "unknown charges" complaints?', options: ['Roaming', 'VAS activated through promo texts', 'Late payment fees', 'Plan upgrades'], correctAnswer: 1, explanation: 'Replying to promo texts can activate paid VAS.' },
        { question: 'How often can a courtesy adjustment for VAS be given?', options: ['Every month', 'Once every 12 months per account', 'Never', 'Unlimited'], correctAnswer: 1, explanation: 'One courtesy adjustment per account every 12 months.' },
        { question: 'When are bills due?', options: ['1st of the month', '15th of the month', '21st of the month', 'End of the month'], correctAnswer: 2, explanation: 'Bills generate on the 1st and are due on the 21st.' },
      ],
    },
  },
  {
    code: 'CRM-104',
    title: 'Navigating the Lumina CRM',
    description: 'How to search accounts, read interaction history, and document calls properly in the CRM. (Draft - not yet published)',
    category: 'Systems & Tools',
    level: 'Beginner',
    estimatedHours: 1,
    isPublished: false,
    owner: 1, // created by the second trainer
    lessons: [
      {
        title: 'Writing Good Call Notes',
        durationMinutes: 15,
        content: `Every call must be documented using the CAR format:

C - CONCERN: What the customer called about
A - ACTION: What you did
R - RESULT: The outcome and any follow-up

Example: "C: Cx reported unknown P850 charge. A: Verified, found VAS add-on, deactivated, applied courtesy adjustment. R: Credit reflects next bill, VAS block added."`,
      },
    ],
  },
];

const scenarios = [
  {
    title: 'Billing Dispute: Unexpected Charge',
    description: 'A postpaid customer sees an unknown P850 charge on her bill. Verify properly, find the cause, and resolve it.',
    category: 'Billing',
    difficulty: 'Medium',
    customer: { name: 'Liza Cruz', mood: 'frustrated', issue: 'Unknown P850 charge on her latest bill' },
    passingScore: 70,
    isPublished: true,
    startStep: 'opening',
    steps: [
      {
        key: 'opening',
        customerLine: "Hello? I just got my bill and there's an extra P850 charge I don't recognize! What is this?",
        options: [
          { text: "Thank you for calling Lumina Telecom, this is your agent. I'm sorry about the unexpected charge, I'll look into it right away. May I have your account number so I can verify your account?", score: 10, feedback: 'Excellent: complete greeting, empathy, and you moved straight to verification.', nextStep: 'verify' },
          { text: "What's your account number?", score: 3, feedback: 'Too abrupt. You skipped the greeting and showed no empathy.', nextStep: 'verify' },
          { text: "Charges are usually correct, ma'am. Did you check your usage?", score: 0, feedback: 'Dismissive. Never assume the customer is wrong before checking.', nextStep: 'upset' },
        ],
      },
      {
        key: 'verify',
        customerLine: "It's 0917-555-0123. My name is Liza Cruz.",
        options: [
          { text: 'Thank you, Ms. Cruz. For your security, may I also have your birthdate or your last payment amount?', score: 10, feedback: 'Correct 2-factor verification before disclosing details (Data Privacy Act compliant).', nextStep: 'explain' },
          { text: 'Thanks! I can see the P850 is for a video streaming add-on.', score: 2, feedback: 'Compliance issue: you disclosed account details before completing verification.', nextStep: 'explain' },
          { text: '(Places the customer on hold without saying anything)', score: 3, feedback: 'Always ask permission and give a time estimate before placing a customer on hold.', nextStep: 'explain' },
        ],
      },
      {
        key: 'explain',
        customerLine: 'Okay... so what is this charge? I never subscribed to anything!',
        options: [
          { text: "I understand how frustrating that is. I see a video streaming add-on was activated on the 3rd through a promo text reply. Did anyone else use your phone around that date?", score: 10, feedback: 'Clear, jargon-free explanation with good probing.', nextStep: 'resolve' },
          { text: 'It is a VAS charge, ma\'am. System-generated.', score: 3, feedback: 'Avoid jargon like "VAS". Explain in plain words.', nextStep: 'resolve' },
          { text: "You must have subscribed. There's nothing I can do.", score: 0, feedback: 'No ownership. This will escalate the call.', nextStep: 'upset' },
        ],
      },
      {
        key: 'upset',
        customerLine: "That's ridiculous! I want to talk to your supervisor right now!",
        options: [
          { text: "I completely understand, and I'm sorry for the frustration. Before I transfer you, may I check what I can do right now? I may be able to resolve this for you.", score: 8, feedback: 'Good recovery: empathy + ownership before escalating.', nextStep: 'resolve' },
          { text: 'Sure, please hold. (Transfers the call)', score: 3, feedback: 'Immediate transfer without trying to help. Missed chance to resolve.', nextStep: null },
          { text: "Ma'am, please calm down.", score: 0, feedback: 'Never tell a customer to calm down. The customer hung up.', nextStep: null },
        ],
      },
      {
        key: 'resolve',
        customerLine: 'My son might have replied to a promo text... Can you remove it?',
        options: [
          { text: "Absolutely. I've deactivated the add-on, filed a one-time courtesy adjustment of P850 for your next bill, and added a VAS block so this won't happen again.", score: 10, feedback: 'Full resolution plus prevention. This is first-call resolution.', nextStep: 'closing' },
          { text: "I'll deactivate it, but I can't refund the charge.", score: 5, feedback: 'Partially resolved. You were allowed to give a courtesy adjustment.', nextStep: 'closing' },
          { text: "You'll need to visit a Lumina store for that.", score: 1, feedback: 'Unnecessary redirection. You could resolve this on the call.', nextStep: 'closing' },
        ],
      },
      {
        key: 'closing',
        customerLine: "Oh, that's great. No, that's all. Thank you!",
        options: [
          { text: "You're welcome, Ms. Cruz! To recap: the add-on is removed and the P850 credit will show on your next bill. Thank you for calling Lumina Telecom, have a great day!", score: 10, feedback: 'Perfect closing: recap, thanks, and branded sign-off.', nextStep: null },
          { text: 'Okay, bye.', score: 2, feedback: 'Weak closing. Always recap and thank the customer.', nextStep: null },
        ],
      },
    ],
  },
  {
    title: 'Slow Internet Complaint',
    description: 'An irate customer has had slow internet for three days and already called twice. De-escalate and troubleshoot.',
    category: 'Technical',
    difficulty: 'Hard',
    customer: { name: 'Ramon Lim', mood: 'irate', issue: 'Slow home internet for 3 days, third time calling' },
    passingScore: 75,
    isPublished: true,
    startStep: 'opening',
    steps: [
      {
        key: 'opening',
        customerLine: "This is the THIRD time I'm calling! My internet has been slow for three days and nobody has fixed it!",
        options: [
          { text: "I'm really sorry you've had to call three times, Mr. Lim. That's not the experience you deserve. I'm going to take ownership of this today. May I verify your account first?", score: 10, feedback: 'Strong LEAP response: empathy, apology, and ownership.', nextStep: 'troubleshoot' },
          { text: 'Sir, I need your account number first.', score: 2, feedback: 'Ignores the emotion. An irate caller needs acknowledgment first.', nextStep: 'troubleshoot' },
        ],
      },
      {
        key: 'troubleshoot',
        customerLine: "Fine. Account is 8800-1234. I already restarted the modem like the last agent said!",
        options: [
          { text: "Thank you, and I appreciate you trying that. I can see from your history that the restart didn't help, so I won't ask you to do it again. Let me run a line test from our end.", score: 10, feedback: 'You read the history and avoided repeating steps. Great.', nextStep: 'result' },
          { text: 'Okay sir, please restart your modem again.', score: 1, feedback: 'Repeating a step that already failed frustrates the customer more.', nextStep: 'result' },
        ],
      },
      {
        key: 'result',
        customerLine: 'So? What did you find?',
        options: [
          { text: "The line test shows a signal issue outside your home, so a technician visit is needed. I've booked the earliest slot tomorrow 9AM-12NN and flagged it as a repeat issue. You'll get an SMS confirmation.", score: 10, feedback: 'Clear finding, concrete next step, and timeframe.', nextStep: 'closing' },
          { text: "There's an issue. Someone will contact you.", score: 3, feedback: 'Vague. Always give specific next steps and timeframes.', nextStep: 'closing' },
        ],
      },
      {
        key: 'closing',
        customerLine: 'Alright. Hopefully this time it gets fixed.',
        options: [
          { text: "I understand, Mr. Lim. I've added my notes so anyone you talk to will know the full history. Is there anything else I can help you with today?", score: 10, feedback: 'Reassuring close with ownership.', nextStep: null },
          { text: 'Thank you for calling.', score: 4, feedback: 'Too short for a repeat-caller. Reassure and offer further help.', nextStep: null },
        ],
      },
    ],
  },
  {
    title: 'Upsell: Plan Upgrade Inquiry',
    description: 'Draft scenario - a customer asks about upgrading their plan.',
    category: 'Sales',
    difficulty: 'Easy',
    customer: { name: 'Tess Ocampo', mood: 'calm', issue: 'Wants more data' },
    passingScore: 70,
    isPublished: false,
    startStep: 'opening',
    steps: [
      {
        key: 'opening',
        customerLine: "Hi! I keep running out of data on my 599 plan. What are my options?",
        options: [
          { text: 'Happy to help! May I ask how many GB you usually use in a month so I can recommend the right plan?', score: 10, feedback: 'Great needs-based probing before recommending.', nextStep: null },
          { text: 'Get the 1499 plan, it is the best.', score: 3, feedback: 'Recommend based on needs, not on price.', nextStep: null },
        ],
      },
    ],
  },
];

module.exports = { users, courses, scenarios };
