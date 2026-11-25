CREATE TABLE `turnos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`queueNumber` int NOT NULL,
	`firstName` varchar(80) NOT NULL,
	`lastName` varchar(80) NOT NULL,
	`cedula` varchar(40) NOT NULL,
	`service` varchar(80) NOT NULL,
	`status` enum('waiting','called','serving','completed','skipped') NOT NULL DEFAULT 'waiting',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`calledAt` timestamp,
	`completedAt` timestamp,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `turnos_id` PRIMARY KEY(`id`),
	CONSTRAINT `turnos_queueNumber_unique` UNIQUE(`queueNumber`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `name` varchar(255);