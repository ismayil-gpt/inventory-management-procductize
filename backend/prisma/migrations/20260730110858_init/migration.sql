-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'STORE_KEEPER');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('GOODS_IN', 'GOODS_OUT', 'TRANSFER', 'CYCLE_COUNT', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "BarcodeSource" AS ENUM ('MANUFACTURER', 'INTERNAL');

-- CreateEnum
CREATE TYPE "RecommendationStatus" AS ENUM ('PENDING', 'APPROVED', 'AMENDED', 'REJECTED', 'ORDERED', 'RECEIVED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "preferredLanguage" TEXT NOT NULL DEFAULT 'en',
    "preferredTheme" TEXT NOT NULL DEFAULT 'system',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "mfaSecret" TEXT,
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Dubai',
    "defaultLanguage" TEXT NOT NULL DEFAULT 'en',
    "logoObjectKey" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocationType" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "depth" INTEGER NOT NULL,
    "canHoldStock" BOOLEAN NOT NULL DEFAULT false,
    "codePattern" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "LocationType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocationNode" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "parentId" TEXT,
    "locationTypeId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameEn" TEXT,
    "nameAr" TEXT,
    "materialisedPath" TEXT NOT NULL,
    "designator" TEXT NOT NULL,
    "depth" INTEGER NOT NULL,
    "barcode" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LocationNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCategory" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "parentId" TEXT,
    "code" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "materialisedPath" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnitOfMeasure" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "isBaseUnit" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "UnitOfMeasure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductAttributeDefinition" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "labelEn" TEXT NOT NULL,
    "labelAr" TEXT NOT NULL,
    "dataType" TEXT NOT NULL,
    "selectOptions" JSONB,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductAttributeDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "barcodeSource" "BarcodeSource" NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "categoryId" TEXT,
    "baseUnitId" TEXT NOT NULL,
    "packSize" INTEGER NOT NULL DEFAULT 1,
    "reorderPoint" INTEGER NOT NULL,
    "minLevel" INTEGER NOT NULL,
    "maxLevel" INTEGER NOT NULL,
    "supplierId" TEXT,
    "customAttributes" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockPosition" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "locationNodeId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockPosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "type" "MovementType" NOT NULL,
    "productId" TEXT NOT NULL,
    "fromLocationNodeId" TEXT,
    "toLocationNodeId" TEXT,
    "quantity" INTEGER NOT NULL,
    "reason" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "leadTimeDays" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recommendation" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "suggestedQty" INTEGER NOT NULL,
    "approvedQty" INTEGER,
    "reasonCode" TEXT NOT NULL,
    "reasoningEn" TEXT NOT NULL,
    "reasoningAr" TEXT NOT NULL,
    "status" "RecommendationStatus" NOT NULL DEFAULT 'PENDING',
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedByUserId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "purchaseOrderId" TEXT,

    CONSTRAINT "Recommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "poNumber" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "pdfKey" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_code_key" ON "Organization"("code");

-- CreateIndex
CREATE UNIQUE INDEX "LocationType_organizationId_code_key" ON "LocationType"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "LocationNode_barcode_key" ON "LocationNode"("barcode");

-- CreateIndex
CREATE INDEX "LocationNode_organizationId_designator_idx" ON "LocationNode"("organizationId", "designator");

-- CreateIndex
CREATE INDEX "LocationNode_materialisedPath_idx" ON "LocationNode"("materialisedPath");

-- CreateIndex
CREATE UNIQUE INDEX "LocationNode_parentId_code_key" ON "LocationNode"("parentId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCategory_organizationId_code_key" ON "ProductCategory"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "UnitOfMeasure_organizationId_code_key" ON "UnitOfMeasure"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "ProductAttributeDefinition_organizationId_key_key" ON "ProductAttributeDefinition"("organizationId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "Product_barcode_key" ON "Product"("barcode");

-- CreateIndex
CREATE UNIQUE INDEX "Product_organizationId_sku_key" ON "Product"("organizationId", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "StockPosition_productId_locationNodeId_key" ON "StockPosition"("productId", "locationNodeId");

-- CreateIndex
CREATE UNIQUE INDEX "StockMovement_clientId_key" ON "StockMovement"("clientId");

-- CreateIndex
CREATE INDEX "StockMovement_productId_createdAt_idx" ON "StockMovement"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_createdAt_idx" ON "StockMovement"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_poNumber_key" ON "PurchaseOrder"("poNumber");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");
