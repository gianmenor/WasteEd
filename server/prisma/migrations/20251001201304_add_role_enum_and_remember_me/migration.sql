-- First, normalize any existing role values to match the enum values
UPDATE `accounts` SET `role` = 'user' WHERE `role` NOT IN ('user', 'admin');
UPDATE `accounts` SET `role` = 'admin' WHERE `role` = 'Admin' OR `role` = 'ADMIN';

-- AlterTable: Change the role column to use ENUM
ALTER TABLE `accounts` MODIFY COLUMN `role` ENUM('user', 'admin') NOT NULL DEFAULT 'user';