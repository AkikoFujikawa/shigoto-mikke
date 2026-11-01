/*
  Warnings:

  - You are about to drop the column `stripe_subscription_id` on the `contracts` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "contracts" DROP COLUMN "stripe_subscription_id",
ADD COLUMN     "active_ends_at" TIMESTAMPTZ,
ADD COLUMN     "stripe_payment_intent_id" VARCHAR(64);
