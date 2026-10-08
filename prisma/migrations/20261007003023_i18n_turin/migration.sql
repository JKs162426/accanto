-- AlterTable
ALTER TABLE "Restaurant" ALTER COLUMN "timezone" SET DEFAULT 'Europe/Rome';

-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "locale" TEXT NOT NULL DEFAULT 'it';

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "data" JSONB;

