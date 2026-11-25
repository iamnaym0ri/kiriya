CREATE TABLE "app_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role" text NOT NULL,
	"label" text DEFAULT 'iPhone' NOT NULL,
	"secret_hash" text NOT NULL,
	"key_version" text NOT NULL,
	"apns_token" text,
	"apns_env" text DEFAULT 'production' NOT NULL,
	"last_error" text,
	"last_success_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "app_devices_role" ON "app_devices" USING btree ("role");--> statement-breakpoint
CREATE UNIQUE INDEX "app_devices_apns_token" ON "app_devices" USING btree ("apns_token");