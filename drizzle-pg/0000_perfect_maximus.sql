CREATE TYPE "public"."turno_status" AS ENUM('waiting', 'called', 'serving', 'completed', 'skipped');--> statement-breakpoint
CREATE TABLE "turnos" (
	"id" serial PRIMARY KEY NOT NULL,
	"queueNumber" integer NOT NULL,
	"firstName" varchar(80) NOT NULL,
	"lastName" varchar(80) NOT NULL,
	"cedula" varchar(40) NOT NULL,
	"service" varchar(100) NOT NULL,
	"status" "turno_status" DEFAULT 'waiting' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"calledAt" timestamp with time zone,
	"completedAt" timestamp with time zone,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "turnos_queueNumber_unique" UNIQUE("queueNumber")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(64) NOT NULL,
	"name" varchar(255),
	"email" varchar(320),
	"loginMethod" varchar(64),
	"role" varchar(16) DEFAULT 'user' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId")
);
