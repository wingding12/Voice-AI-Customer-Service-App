/**
 * Socket.io Test Client
 * 
 * Tests real-time WebSocket events.
 * Run: npx tsx test-scripts/socket-client.ts [call_id]
 */

import { io } from 'socket.io-client';

const CALL_ID = process.argv[2] || 'test-call-' + Date.now();
const SOCKET_URL = 'http://localhost:3001';

console.log('========================================');
console.log('🔌 Socket.io Test Client');
console.log('========================================');
console.log(`Server: ${SOCKET_URL}`);
console.log(`Call ID: ${CALL_ID}`);
console.log('');

const socket = io(SOCKET_URL, {
  transports: ['websocket', 'polling'],
  reconnection: true,
});

// Connection events
socket.on('connect', () => {
  console.log('✅ Connected:', socket.id);
  console.log('');
  
  // Join call room
  console.log(`📞 Joining call room: ${CALL_ID}`);
  socket.emit('call:join', CALL_ID);
  console.log('');
  console.log('👂 Listening for events...');
  console.log('   (Run webhook tests in another terminal)');
  console.log('');
});

socket.on('disconnect', (reason) => {
  console.log('🔌 Disconnected:', reason);
});

socket.on('connect_error', (error) => {
  console.error('❌ Connection error:', error.message);
});

// Call events
socket.on('call:state_update', (data) => {
  console.log('📊 [call:state_update]', JSON.stringify(data, null, 2));
});

socket.on('transcript:update', (data) => {
  const speaker = data.speaker === 'AI' ? '🤖' : data.speaker === 'CUSTOMER' ? '👤' : '🙋';
  console.log(`📝 [transcript:update] ${speaker} ${data.speaker}: "${data.text}"`);
});

socket.on('copilot:suggestion', (data) => {
  console.log('💡 [copilot:suggestion]', JSON.stringify(data, null, 2));
});

socket.on('call:switch', (data) => {
  const arrow = data.direction === 'AI_TO_HUMAN' ? '🤖→👤' : '👤→🤖';
  console.log(`🔄 [call:switch] ${arrow} ${data.direction}`);
});

socket.on('call:end', (data) => {
  console.log('📞 [call:end] Call has ended');
  console.log(data);
});

// Test switch after 5 seconds
setTimeout(() => {
  console.log('');
  console.log('🔄 Testing switch request (AI→Human)...');
  socket.emit('call:request_switch', {
    callId: CALL_ID,
    direction: 'AI_TO_HUMAN'
  });
}, 5000);

// Keep alive for 60 seconds
console.log('');
console.log('⏱️  Client will disconnect in 60 seconds...');
console.log('   Press Ctrl+C to exit earlier');
console.log('');

setTimeout(() => {
  console.log('');
  console.log('⏱️  Timeout reached, disconnecting...');
  socket.disconnect();
  process.exit(0);
}, 60000);

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('');
  console.log('👋 Disconnecting...');
  socket.disconnect();
  process.exit(0);
});

