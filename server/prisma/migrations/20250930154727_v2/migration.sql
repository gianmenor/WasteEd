/*
  Warnings:

  - You are about to drop the column `category` on the `waste_items` table. All the data in the column will be lost.
  - You are about to drop the column `quantity` on the `waste_items` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[date]` on the table `waste_items` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `date` to the `waste_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `waste_items` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `waste_items` DROP COLUMN `category`,
    DROP COLUMN `quantity`,
    ADD COLUMN `biodegradable` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `date` DATE NOT NULL,
    ADD COLUMN `nonBiodegradable` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `recyclable` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `waste_items_date_key` ON `waste_items`(`date`);
