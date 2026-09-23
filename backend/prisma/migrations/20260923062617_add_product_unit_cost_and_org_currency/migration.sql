-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'AED';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "unitCost" DECIMAL(10,2);
