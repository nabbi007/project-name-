-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'FIELD_AGENT', 'BUYER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "FarmerStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CategoryStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "VoiceSessionStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('CROP', 'QUANTITY', 'UNIT', 'AVAILABILITY_DATE', 'PRICE', 'ADDITIONAL_INFORMATION');

-- CreateEnum
CREATE TYPE "ProcessingStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('DRAFT', 'PROCESSING', 'PENDING_REVIEW', 'PUBLISHED', 'RESERVED', 'SOLD_OUT', 'EXPIRED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CropMatchStatus" AS ENUM ('MATCH', 'MISMATCH', 'UNCLEAR', 'MANUAL_REVIEW_REQUIRED');

-- CreateEnum
CREATE TYPE "ImageStatus" AS ENUM ('PENDING', 'ANALYSED', 'REVIEWED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AudioMessageType" AS ENUM ('LISTING_PUBLISHED', 'NEW_ORDER', 'ORDER_CANCELLED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'AWAITING_COLLECTION', 'COLLECTED', 'IN_TRANSIT', 'READY_FOR_PICKUP', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SIMULATED_PAID', 'CASH_ON_DELIVERY', 'PAY_ON_PICKUP', 'FAILED');

-- CreateEnum
CREATE TYPE "ComplaintStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AiApiType" AS ENUM ('SPEECH_TO_TEXT', 'AGENT_CHAT', 'VISION', 'TEXT_TO_SPEECH');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'BUYER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Farmer" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "fieldAgentId" INTEGER NOT NULL,
    "fullName" TEXT NOT NULL,
    "displayName" TEXT,
    "phone" TEXT,
    "gender" TEXT,
    "preferredLanguage" TEXT,
    "region" TEXT,
    "district" TEXT,
    "community" TEXT,
    "consentConfirmedAt" TIMESTAMP(3),
    "status" "FarmerStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Farmer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CropCategory" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "defaultUnit" TEXT,
    "status" "CategoryStatus" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "CropCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoiceSession" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "farmerId" INTEGER NOT NULL,
    "fieldAgentId" INTEGER NOT NULL,
    "sessionReference" TEXT NOT NULL,
    "status" "VoiceSessionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "VoiceSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoiceResponse" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "voiceSessionId" INTEGER NOT NULL,
    "questionType" "QuestionType" NOT NULL,
    "audioPath" TEXT,
    "language" TEXT,
    "sttSessionId" TEXT,
    "transcript" TEXT,
    "correctedTranscript" TEXT,
    "processingStatus" "ProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoiceResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProduceListing" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "farmerId" INTEGER NOT NULL,
    "fieldAgentId" INTEGER NOT NULL,
    "cropCategoryId" INTEGER,
    "voiceSessionId" INTEGER,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "quantity" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "availableQuantity" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "unit" TEXT,
    "pricePerUnit" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "availableDate" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "region" TEXT,
    "community" TEXT,
    "visionDescription" TEXT,
    "visualObservation" TEXT,
    "agentConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "status" "ListingStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProduceListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListingImage" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "produceListingId" INTEGER NOT NULL,
    "imagePath" TEXT NOT NULL,
    "visionPrompt" TEXT,
    "visionResponse" TEXT,
    "cropMatchStatus" "CropMatchStatus" NOT NULL DEFAULT 'MANUAL_REVIEW_REQUIRED',
    "reviewedBy" INTEGER,
    "reviewedAt" TIMESTAMP(3),
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "status" "ImageStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListingImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedAudio" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "farmerId" INTEGER,
    "produceListingId" INTEGER,
    "orderId" INTEGER,
    "messageType" "AudioMessageType" NOT NULL,
    "textContent" TEXT NOT NULL,
    "audioPath" TEXT,
    "processingStatus" "ProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "playedAt" TIMESTAMP(3),
    "farmerConfirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeneratedAudio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "buyerId" INTEGER NOT NULL,
    "subtotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "deliveryFee" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "deliveryMethod" TEXT,
    "deliveryLocation" TEXT,
    "paymentMethod" TEXT,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "orderId" INTEGER NOT NULL,
    "produceListingId" INTEGER NOT NULL,
    "farmerId" INTEGER NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "unitPrice" DECIMAL(65,30) NOT NULL,
    "subtotal" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderStatusHistory" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "orderId" INTEGER NOT NULL,
    "changedById" INTEGER,
    "previousStatus" "OrderStatus",
    "newStatus" "OrderStatus" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Complaint" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "orderId" INTEGER NOT NULL,
    "buyerId" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "ComplaintStatus" NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "resolvedById" INTEGER,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Complaint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiProcessingRun" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "processableType" TEXT NOT NULL,
    "processableId" INTEGER NOT NULL,
    "apiType" "AiApiType" NOT NULL,
    "sessionId" TEXT,
    "requestSummary" TEXT,
    "responseContent" TEXT,
    "processingStatus" "ProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "httpStatus" INTEGER,
    "errorMessage" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiProcessingRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_uuid_key" ON "User"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Farmer_uuid_key" ON "Farmer"("uuid");

-- CreateIndex
CREATE INDEX "Farmer_fieldAgentId_idx" ON "Farmer"("fieldAgentId");

-- CreateIndex
CREATE INDEX "Farmer_status_idx" ON "Farmer"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CropCategory_uuid_key" ON "CropCategory"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "CropCategory_name_key" ON "CropCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "CropCategory_slug_key" ON "CropCategory"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "VoiceSession_uuid_key" ON "VoiceSession"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "VoiceSession_sessionReference_key" ON "VoiceSession"("sessionReference");

-- CreateIndex
CREATE INDEX "VoiceSession_farmerId_idx" ON "VoiceSession"("farmerId");

-- CreateIndex
CREATE INDEX "VoiceSession_fieldAgentId_idx" ON "VoiceSession"("fieldAgentId");

-- CreateIndex
CREATE UNIQUE INDEX "VoiceResponse_uuid_key" ON "VoiceResponse"("uuid");

-- CreateIndex
CREATE INDEX "VoiceResponse_voiceSessionId_idx" ON "VoiceResponse"("voiceSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "ProduceListing_uuid_key" ON "ProduceListing"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "ProduceListing_slug_key" ON "ProduceListing"("slug");

-- CreateIndex
CREATE INDEX "ProduceListing_farmerId_idx" ON "ProduceListing"("farmerId");

-- CreateIndex
CREATE INDEX "ProduceListing_fieldAgentId_idx" ON "ProduceListing"("fieldAgentId");

-- CreateIndex
CREATE INDEX "ProduceListing_status_idx" ON "ProduceListing"("status");

-- CreateIndex
CREATE INDEX "ProduceListing_cropCategoryId_idx" ON "ProduceListing"("cropCategoryId");

-- CreateIndex
CREATE UNIQUE INDEX "ListingImage_uuid_key" ON "ListingImage"("uuid");

-- CreateIndex
CREATE INDEX "ListingImage_produceListingId_idx" ON "ListingImage"("produceListingId");

-- CreateIndex
CREATE UNIQUE INDEX "GeneratedAudio_uuid_key" ON "GeneratedAudio"("uuid");

-- CreateIndex
CREATE INDEX "GeneratedAudio_farmerId_idx" ON "GeneratedAudio"("farmerId");

-- CreateIndex
CREATE INDEX "GeneratedAudio_produceListingId_idx" ON "GeneratedAudio"("produceListingId");

-- CreateIndex
CREATE INDEX "GeneratedAudio_orderId_idx" ON "GeneratedAudio"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_uuid_key" ON "Order"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");

-- CreateIndex
CREATE INDEX "Order_buyerId_idx" ON "Order"("buyerId");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE UNIQUE INDEX "OrderItem_uuid_key" ON "OrderItem"("uuid");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderItem_produceListingId_idx" ON "OrderItem"("produceListingId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderStatusHistory_uuid_key" ON "OrderStatusHistory"("uuid");

-- CreateIndex
CREATE INDEX "OrderStatusHistory_orderId_idx" ON "OrderStatusHistory"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Complaint_uuid_key" ON "Complaint"("uuid");

-- CreateIndex
CREATE INDEX "Complaint_orderId_idx" ON "Complaint"("orderId");

-- CreateIndex
CREATE INDEX "Complaint_buyerId_idx" ON "Complaint"("buyerId");

-- CreateIndex
CREATE INDEX "Complaint_status_idx" ON "Complaint"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AiProcessingRun_uuid_key" ON "AiProcessingRun"("uuid");

-- CreateIndex
CREATE INDEX "AiProcessingRun_processableType_processableId_idx" ON "AiProcessingRun"("processableType", "processableId");

-- CreateIndex
CREATE INDEX "AiProcessingRun_apiType_idx" ON "AiProcessingRun"("apiType");

-- CreateIndex
CREATE INDEX "AiProcessingRun_processingStatus_idx" ON "AiProcessingRun"("processingStatus");

-- AddForeignKey
ALTER TABLE "Farmer" ADD CONSTRAINT "Farmer_fieldAgentId_fkey" FOREIGN KEY ("fieldAgentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceSession" ADD CONSTRAINT "VoiceSession_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "Farmer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceSession" ADD CONSTRAINT "VoiceSession_fieldAgentId_fkey" FOREIGN KEY ("fieldAgentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceResponse" ADD CONSTRAINT "VoiceResponse_voiceSessionId_fkey" FOREIGN KEY ("voiceSessionId") REFERENCES "VoiceSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProduceListing" ADD CONSTRAINT "ProduceListing_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "Farmer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProduceListing" ADD CONSTRAINT "ProduceListing_fieldAgentId_fkey" FOREIGN KEY ("fieldAgentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProduceListing" ADD CONSTRAINT "ProduceListing_cropCategoryId_fkey" FOREIGN KEY ("cropCategoryId") REFERENCES "CropCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProduceListing" ADD CONSTRAINT "ProduceListing_voiceSessionId_fkey" FOREIGN KEY ("voiceSessionId") REFERENCES "VoiceSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingImage" ADD CONSTRAINT "ListingImage_produceListingId_fkey" FOREIGN KEY ("produceListingId") REFERENCES "ProduceListing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingImage" ADD CONSTRAINT "ListingImage_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedAudio" ADD CONSTRAINT "GeneratedAudio_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "Farmer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedAudio" ADD CONSTRAINT "GeneratedAudio_produceListingId_fkey" FOREIGN KEY ("produceListingId") REFERENCES "ProduceListing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedAudio" ADD CONSTRAINT "GeneratedAudio_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_produceListingId_fkey" FOREIGN KEY ("produceListingId") REFERENCES "ProduceListing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
