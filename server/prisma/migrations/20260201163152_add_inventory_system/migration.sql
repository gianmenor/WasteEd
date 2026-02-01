-- CreateTable
CREATE TABLE `inventory_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `cost` INTEGER NOT NULL DEFAULT 1,
    `stock` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `inventory_items_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inventory_redemptions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `itemId` INTEGER NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `totalCost` INTEGER NOT NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `inventory_redemptions` ADD CONSTRAINT `inventory_redemptions_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `inventory_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
