#!/bin/bash

# Test the tool-based chat endpoint
# Make sure the dev server is running before executing this script

echo "🧪 Testing Frank Tool-Based Chat API"
echo "===================================="
echo ""

# Test 1: Simple greeting (should use minimal tools)
echo "Test 1: Greeting"
echo "----------------"
curl -X POST http://localhost:3000/api/chat-tools \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hi there!",
    "chatHistory": [],
    "userId": "test_user_001",
    "sessionId": "test_session_001"
  }' | jq '.'

echo ""
echo ""

# Test 2: Full profile in one message (should extract all fields)
echo "Test 2: Complete Profile Extraction"
echo "-----------------------------------"
curl -X POST http://localhost:3000/api/chat-tools \
  -H "Content-Type: application/json" \
  -d '{
    "message": "I need R500k for my retail business in Gauteng, been trading 3 years, monthly turnover is R300k, VAT registered",
    "chatHistory": [],
    "userId": "test_user_002",
    "sessionId": "test_session_002"
  }' | jq '.'

echo ""
echo ""

# Test 3: Incremental data collection
echo "Test 3: Incremental Collection"
echo "------------------------------"
curl -X POST http://localhost:3000/api/chat-tools \
  -H "Content-Type: application/json" \
  -d '{
    "message": "I need funding",
    "chatHistory": [],
    "userId": "test_user_003",
    "sessionId": "test_session_003"
  }' | jq '.'

echo ""
echo ""

# Test 4: Lender-specific question
echo "Test 4: Lender Query"
echo "--------------------"
curl -X POST http://localhost:3000/api/chat-tools \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Tell me about Lulalend requirements",
    "chatHistory": [],
    "userId": "test_user_004",
    "sessionId": "test_session_004"
  }' | jq '.'

echo ""
echo "===================================="
echo "✅ All tests completed!"
