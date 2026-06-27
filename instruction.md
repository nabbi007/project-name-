AGROVOICE BACKEND DEVELOPMENT PLAN

1. Backend Objective
   The backend will serve as the central control system for AgroVoice.
   It will be responsible for:
   • User authentication
   • Role-based permissions
   • Farmer records
   • Voice recording uploads
   • Snwolley API integrations
   • Produce listings
   • Crop-image analysis
   • Generated farmer audio
   • Marketplace data
   • Orders
   • Inventory control
   • Administration
   • Error handling
   • Security
   • Database management
   The React frontend must never call the Snwolley APIs directly. All AI requests must pass through the Node.js backend.

---

2. Backend Technology Stack
   • Node.js
   • Express.js
   • TypeScript
   • PostgreSQL
   • Prisma ORM
   • JWT authentication
   • bcrypt
   • Axios
   • Multer
   • Zod
   • Helmet
   • CORS
   • Express rate limiting

---

3. Recommended Backend Structure
   server/
   ├── prisma/
   │ ├── schema.prisma
   │ ├── migrations/
   │ └── seed.ts
   ├── src/
   │ ├── config/
   │ │ ├── database.ts
   │ │ ├── environment.ts
   │ │ └── snwolley.ts
   │ ├── controllers/
   │ ├── middleware/
   │ ├── modules/
   │ │ ├── auth/
   │ │ ├── users/
   │ │ ├── farmers/
   │ │ ├── crops/
   │ │ ├── voice/
   │ │ ├── listings/
   │ │ ├── marketplace/
   │ │ ├── orders/
   │ │ ├── complaints/
   │ │ └── administration/
   │ ├── services/
   │ │ └── snwolley/
   │ │ ├── snwolley.client.ts
   │ │ ├── speech-to-text.service.ts
   │ │ ├── agent-chat.service.ts
   │ │ ├── vision.service.ts
   │ │ ├── text-to-speech.service.ts
   │ │ ├── listing-extraction.service.ts
   │ │ └── vision-structuring.service.ts
   │ ├── validators/
   │ ├── utils/
   │ ├── routes/
   │ ├── app.ts
   │ └── server.ts
   ├── uploads/
   │ ├── audio/
   │ ├── images/
   │ └── generated-audio/
   ├── tests/
   ├── .env.example
   └── package.json

---

4. Environment Variables
   PORT=5000
   DATABASE_URL=
   JWT_SECRET=
   JWT_EXPIRES_IN=1d
   CLIENT_URL=http://localhost:5173

SNWOLLEY_BASE_URL=https://v1.snwolley.ai
SNWOLLEY_HACKATHON_API_KEY=
SNWOLLEY_AGENT_API_KEY=
SNWOLLEY_AGENT_ID=
SNWOLLEY_TIMEOUT=60000
Rules:
• Never expose the API keys to React.
• Never commit .env.
• Never log authentication headers.
• Provide only .env.example in GitHub.

---

5. Core Database Models
   The backend developer should create the following Prisma models.
   User
   Fields:
   • id
   • uuid
   • name
   • email
   • phone
   • passwordHash
   • role
   • status
   • createdAt
   • updatedAt
   Roles:
   • ADMIN
   • FIELD_AGENT
   • BUYER
   Farmer
   Fields:
   • id
   • uuid
   • fieldAgentId
   • fullName
   • displayName
   • phone
   • gender
   • preferredLanguage
   • region
   • district
   • community
   • consentConfirmedAt
   • status
   • notes
   • createdAt
   • updatedAt
   CropCategory
   Fields:
   • id
   • uuid
   • name
   • slug
   • description
   • defaultUnit
   • status
   VoiceSession
   Fields:
   • id
   • uuid
   • farmerId
   • fieldAgentId
   • sessionReference
   • status
   • startedAt
   • completedAt
   VoiceResponse
   Fields:
   • id
   • uuid
   • voiceSessionId
   • questionType
   • audioPath
   • language
   • sttSessionId
   • transcript
   • correctedTranscript
   • processingStatus
   • errorMessage
   ProduceListing
   Fields:
   • id
   • uuid
   • farmerId
   • fieldAgentId
   • cropCategoryId
   • voiceSessionId
   • title
   • slug
   • description
   • quantity
   • availableQuantity
   • unit
   • pricePerUnit
   • availableDate
   • expiresAt
   • region
   • community
   • visionDescription
   • visualObservation
   • agentConfirmed
   • status
   • publishedAt
   ListingImage
   Fields:
   • id
   • uuid
   • produceListingId
   • imagePath
   • visionPrompt
   • visionResponse
   • cropMatchStatus
   • reviewedBy
   • reviewedAt
   • isPrimary
   • status
   GeneratedAudio
   Fields:
   • id
   • uuid
   • farmerId
   • produceListingId
   • orderId
   • messageType
   • textContent
   • audioPath
   • processingStatus
   • playedAt
   • farmerConfirmedAt
   Order
   Fields:
   • id
   • uuid
   • orderNumber
   • buyerId
   • subtotal
   • deliveryFee
   • totalAmount
   • deliveryMethod
   • deliveryLocation
   • paymentMethod
   • paymentStatus
   • status
   • notes
   • createdAt
   • updatedAt
   OrderItem
   Fields:
   • id
   • uuid
   • orderId
   • produceListingId
   • farmerId
   • quantity
   • unitPrice
   • subtotal
   OrderStatusHistory
   Fields:
   • id
   • uuid
   • orderId
   • changedById
   • previousStatus
   • newStatus
   • notes
   • createdAt
   Complaint
   Fields:
   • id
   • uuid
   • orderId
   • buyerId
   • category
   • description
   • status
   • resolution
   • resolvedById
   • resolvedAt
   AiProcessingRun
   Fields:
   • id
   • uuid
   • processableType
   • processableId
   • apiType
   • sessionId
   • requestSummary
   • responseContent
   • processingStatus
   • httpStatus
   • errorMessage
   • attempts
   • startedAt
   • completedAt

---

6. Backend Standards
   Standard success response
   {
   "success": true,
   "message": "Operation completed successfully",
   "data": {}
   }
   Standard validation response
   {
   "success": false,
   "message": "Validation failed",
   "errors": {
   "fieldName": [
   "Error message"
   ]
   }
   }
   Standard general error
   {
   "success": false,
   "message": "Something went wrong",
   "code": "INTERNAL_ERROR"
   }
   Paginated response
   {
   "success": true,
   "data": [],
   "pagination": {
   "page": 1,
   "limit": 20,
   "total": 100,
   "totalPages": 5
   }
   }

---

7. Phase 1: Backend Foundation
   Tasks
   • Initialise Node.js project.
   • Configure TypeScript.
   • Set up Express.
   • Connect PostgreSQL.
   • Configure Prisma.
   • Create initial migration.
   • Configure environment validation.
   • Add Helmet.
   • Configure CORS.
   • Add request logging.
   • Add rate limiting.
   • Add global error middleware.
   • Add standard response helpers.
   • Create health-check endpoint.
   Endpoint
   GET /api/health
   Expected result
   {
   "success": true,
   "message": "AgroVoice API is running"
   }
   Deliverables
   • Running Express server
   • Database connection
   • Prisma migration setup
   • Error middleware
   • API-response helpers
   • .env.example

---

8. Phase 2: Authentication and Roles
   Tasks
   • Create User model.
   • Create user-role enum.
   • Create user-status enum.
   • Implement password hashing.
   • Implement JWT creation.
   • Implement JWT verification.
   • Create authentication middleware.
   • Create role middleware.
   • Create account-status middleware.
   • Create buyer registration.
   • Create user login.
   • Create current-user endpoint.
   • Create admin field-agent creation.
   • Seed one administrator.
   Endpoints
   POST /api/auth/register
   POST /api/auth/login
   GET /api/auth/me
   POST /api/auth/logout
   POST /api/admin/agents
   Rules
   • Only buyers can register publicly.
   • Only administrators can create field agents.
   • Suspended users cannot log in.
   • User roles must never be accepted blindly from the frontend.
   • Passwords must never be returned.
   Deliverables
   • Working authentication
   • JWT protection
   • Role restrictions
   • Test admin account
   • Test field-agent account
   • Test buyer account

---

9. Phase 3: Farmer Management
   Tasks
   • Create Farmer model.
   • Relate farmers to field agents.
   • Create farmer validation.
   • Create farmer registration.
   • Create farmer listing.
   • Create farmer details.
   • Create farmer updates.
   • Create farmer-status updates.
   • Add farmer search and pagination.
   • Prevent field agents from accessing another agent’s farmers.
   • Hide sensitive information from public endpoints.
   Endpoints
   GET /api/farmers
   POST /api/farmers
   GET /api/farmers/:farmerId
   PATCH /api/farmers/:farmerId
   PATCH /api/farmers/:farmerId/status
   Deliverables
   • Farmer CRUD
   • Farmer-agent ownership
   • Farmer search
   • Farmer status
   • Authorisation tests

---

10. Phase 4: Voice Sessions and Speech-to-Text
    Tasks
    • Create VoiceSession model.
    • Create VoiceResponse model.
    • Configure Multer for audio.
    • Validate audio MIME type.
    • Validate file size.
    • Generate safe filenames.
    • Create a voice session.
    • Upload individual voice answers.
    • Send audio to Snwolley STT.
    • Save original transcript.
    • Allow corrected transcript.
    • Save STT session ID.
    • Record AI-processing run.
    • Handle retries.
    Question types
    • CROP
    • QUANTITY
    • UNIT
    • AVAILABILITY_DATE
    • PRICE
    • ADDITIONAL_INFORMATION
    Endpoints
    POST /api/farmers/:farmerId/voice-sessions
    GET /api/voice-sessions/:sessionId
    POST /api/voice-sessions/:sessionId/responses
    POST /api/voice-responses/:responseId/transcribe
    PATCH /api/voice-responses/:responseId/transcript
    POST /api/voice-responses/:responseId/retry
    STT workflow
    Receive uploaded audio
    → Validate file
    → Store file
    → Create AI processing record
    → Send file to Snwolley STT
    → Receive text
    → Save transcript
    → Return transcript to frontend
    Failure handling
    • Invalid format
    • Empty recording
    • File too large
    • API timeout
    • Rate limit
    • Invalid API key
    • Empty transcript
    • Snwolley service unavailable
    Manual fallback
    The endpoint must allow the field agent to enter a transcript manually.
    Deliverables
    • Audio upload
    • STT integration
    • Transcript correction
    • Retry support
    • AI logs

---

11. Phase 5: Agents API Listing Extraction
    Tasks
    • Load all approved transcripts.
    • Prefer corrected transcript over original transcript.
    • Combine transcripts by question type.
    • Build a listing-extraction prompt.
    • Send the prompt to the Agents API.
    • Extract content from the response.
    • Remove markdown code fences where present.
    • Parse returned JSON.
    • Validate required fields.
    • Store chat ID.
    • Create a draft ProduceListing.
    • Return incomplete fields to the frontend.
    • Allow manual completion.
    Endpoint
    POST /api/voice-sessions/:sessionId/extract-listing
    Required extracted fields
    {
    "crop": "Tomato",
    "quantity": 10,
    "unit": "BASKET",
    "pricePerUnit": 180,
    "availableDate": "2026-07-03",
    "description": "Ten baskets of tomatoes available from Friday."
    }
    Validation rules
    • Crop must exist or be mapped to a crop category.
    • Quantity must be greater than zero.
    • Unit must be supported.
    • Price must be greater than zero.
    • Date must be valid.
    • Description must be plain text.
    • The AI response must never publish automatically.
    Deliverables
    • Transcript combination
    • Agents API integration
    • Safe JSON parsing
    • Draft-listing generation
    • Manual fallback

---

12. Phase 6: Vision API
    Tasks
    • Configure image uploads.
    • Validate image MIME type.
    • Validate image size.
    • Store crop images.
    • Send image to Vision.
    • Provide a clear crop-analysis prompt.
    • Store the returned description.
    • Send Vision description to Agents API for structuring.
    • Compare selected crop with identified crop.
    • Set crop-match status.
    • Require human review.
    • Create retry support.
    Endpoints
    POST /api/listings/:listingId/images
    POST /api/listing-images/:imageId/analyse
    POST /api/listing-images/:imageId/retry
    PATCH /api/listing-images/:imageId/review
    Structured observation
    {
    "identifiedCrop": "Tomato",
    "colour": "Red and orange",
    "maturity": "Ripe and partially ripe",
    "visibleCondition": "Mostly firm",
    "visibleIssues": [
    "Minor bruising"
    ],
    "recommendation": "Human review required",
    "warning": "Observation is based only on visible image features."
    }
    Crop-match statuses
    • MATCH
    • MISMATCH
    • UNCLEAR
    • MANUAL_REVIEW_REQUIRED
    Important rule
    The backend must not describe Vision results as certified food-safety or laboratory analysis.
    Deliverables
    • Image upload
    • Vision integration
    • Structured observations
    • Crop comparison
    • Agent-review support

---

13. Phase 7: Listing Management and Publication
    Tasks
    • Create crop-category endpoints.
    • Create draft-listing update.
    • Validate publication requirements.
    • Publish a listing.
    • Generate listing slug.
    • Expire old listings.
    • Mark listings as sold out.
    • Prevent draft listings from appearing publicly.
    • Protect farmer phone numbers.
    • Add pagination and filters.
    Endpoints
    GET /api/crop-categories
    POST /api/crop-categories
    GET /api/listings
    POST /api/listings
    GET /api/listings/:listingId
    PATCH /api/listings/:listingId
    POST /api/listings/:listingId/publish
    POST /api/listings/:listingId/unpublish
    Publication requirements
    • Farmer is active.
    • Listing is owned by the field agent.
    • Crop category is valid.
    • Quantity is greater than zero.
    • Price is greater than zero.
    • Availability date is valid.
    • Crop image exists.
    • Agent has confirmed the listing.
    • Farmer consent is recorded.
    Listing statuses
    • DRAFT
    • PROCESSING
    • PENDING_REVIEW
    • PUBLISHED
    • RESERVED
    • SOLD_OUT
    • EXPIRED
    • REJECTED
    Deliverables
    • Listing CRUD
    • Publication validation
    • Expiry logic
    • Public-data protection

---

14. Phase 8: Text-to-Speech
    Tasks
    • Create confirmation-message templates.
    • Send confirmation text to TTS.
    • Store returned WAV file.
    • Create secure audio endpoint.
    • Track whether audio was played.
    • Track whether farmer confirmed.
    • Generate listing-publication audio.
    • Generate new-order audio.
    • Generate order-cancellation audio.
    • Add retry support.
    Endpoints
    POST /api/listings/:listingId/generate-confirmation
    POST /api/orders/:orderId/generate-farmer-audio
    GET /api/generated-audio/:audioId
    PATCH /api/generated-audio/:audioId/played
    PATCH /api/generated-audio/:audioId/farmer-confirmed
    Example listing message
    Your listing has been created successfully.
    Ten baskets of tomatoes are available from Friday at 180 Ghana cedis per basket.
    Deliverables
    • TTS integration
    • WAV storage
    • Audio retrieval
    • Playback tracking
    • Farmer-confirmation tracking

---

15. Phase 9: Public Marketplace API
    Tasks
    • Create public listing endpoint.
    • Create listing-details endpoint.
    • Create public farmer profile.
    • Add search.
    • Add crop filter.
    • Add region filter.
    • Add community filter.
    • Add price filter.
    • Add availability filter.
    • Add pagination.
    • Exclude expired, rejected and draft listings.
    • Hide private farmer information.
    Endpoints
    GET /api/marketplace/listings
    GET /api/marketplace/listings/:listingId
    GET /api/marketplace/farmers/:farmerId
    Optional endpoint
    POST /api/marketplace/search
    This endpoint can use the Agents API to convert a natural-language buyer query into database filters.
    Deliverables
    • Public marketplace data
    • Search
    • Filters
    • Pagination
    • Privacy protection

---

16. Phase 10: Orders and Inventory
    Tasks
    • Create Order model.
    • Create OrderItem model.
    • Create order-status history.
    • Generate unique order numbers.
    • Validate listing availability.
    • Use database transactions.
    • Lock listing records during ordering.
    • Recalculate totals on the backend.
    • Reduce available quantity.
    • Mark listing sold out when necessary.
    • Create mock payment statuses.
    • Allow authorised status updates.
    • Create order cancellation.
    • Restore stock when eligible.
    • Generate farmer-order notification.
    Endpoints
    POST /api/orders
    GET /api/orders
    GET /api/orders/:orderId
    PATCH /api/orders/:orderId/status
    POST /api/orders/:orderId/cancel
    POST /api/orders/:orderId/farmer-confirmation
    Order statuses
    • PENDING
    • CONFIRMED
    • AWAITING_COLLECTION
    • COLLECTED
    • IN_TRANSIT
    • READY_FOR_PICKUP
    • DELIVERED
    • COMPLETED
    • CANCELLED
    • DISPUTED
    Payment statuses
    • PENDING
    • SIMULATED_PAID
    • CASH_ON_DELIVERY
    • PAY_ON_PICKUP
    • FAILED
    Critical transaction flow
    Begin database transaction
    → Lock listing
    → Verify available quantity
    → Calculate subtotal
    → Create order
    → Create order items
    → Reduce stock
    → Update listing status where necessary
    → Commit transaction
    Deliverables
    • Order creation
    • Inventory protection
    • Order tracking
    • Cancellation logic
    • Farmer notifications

---

17. Phase 11: Administration
    Tasks
    • Create dashboard statistics.
    • List agents.
    • Activate or suspend agents.
    • View all farmers.
    • Review listings.
    • Reject or unpublish listings.
    • View all orders.
    • View AI processing runs.
    • Retry failed AI operations.
    • Manage complaints.
    • Create audit records.
    Endpoints
    GET /api/admin/dashboard
    GET /api/admin/agents
    PATCH /api/admin/agents/:agentId/status
    GET /api/admin/farmers
    GET /api/admin/listings
    PATCH /api/admin/listings/:listingId/status
    GET /api/admin/orders
    GET /api/admin/ai-runs
    POST /api/admin/ai-runs/:runId/retry
    GET /api/admin/complaints
    PATCH /api/admin/complaints/:complaintId
    Deliverables
    • Admin statistics
    • Agent management
    • Listing moderation
    • AI monitoring
    • Complaint management

---

18. Backend Security Requirements
    The backend developer must implement:
    • Password hashing
    • JWT verification
    • Role middleware
    • Account-status checks
    • Request validation
    • File-size limits
    • File-type validation
    • Rate limiting
    • CORS restrictions
    • Helmet
    • Safe filenames
    • Sensitive-data filtering
    • Database constraints
    • Audit logs
    • API timeouts
    • Duplicate-request prevention
    • Environment-variable protection
    Never trust:
    • Frontend roles
    • Frontend totals
    • Frontend listing status
    • Frontend stock quantity
    • AI-generated data
    • Uploaded file extensions alone

---

19. Backend Testing Requirements
    Test:
    • Authentication
    • Role restrictions
    • Farmer ownership
    • Farmer registration
    • Audio upload
    • STT success and failure
    • Transcript correction
    • Agents API valid and invalid JSON
    • Vision success and failure
    • TTS success and failure
    • Listing publication rules
    • Public-data privacy
    • Order inventory transactions
    • Overselling prevention
    • Cancellation
    • AI retries

---

20. Backend Definition of Done
    A backend feature is complete when:
    • Database migration is created.
    • Validation is implemented.
    • Authorisation is implemented.
    • Endpoint works.
    • Error responses follow the standard format.
    • AI failure has a manual fallback.
    • Postman request is available.
    • API documentation is updated.
    • Tests pass.
    • Frontend developer has received the contract.
