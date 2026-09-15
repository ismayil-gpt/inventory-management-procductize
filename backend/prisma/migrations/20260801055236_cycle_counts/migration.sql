-- CreateEnum
CREATE TYPE "CycleCountStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateTable
CREATE TABLE "CycleCount" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "status" "CycleCountStatus" NOT NULL DEFAULT 'OPEN',
    "note" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "CycleCount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CycleCountLine" (
    "id" TEXT NOT NULL,
    "cycleCountId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "locationNodeId" TEXT NOT NULL,
    "countedQty" INTEGER NOT NULL,
    "systemQty" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CycleCountLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CycleCountLine_cycleCountId_idx" ON "CycleCountLine"("cycleCountId");

-- CreateIndex
CREATE UNIQUE INDEX "CycleCountLine_cycleCountId_productId_locationNodeId_key" ON "CycleCountLine"("cycleCountId", "productId", "locationNodeId");
