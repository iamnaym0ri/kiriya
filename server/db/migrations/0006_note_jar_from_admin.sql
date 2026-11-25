CREATE TABLE "jar_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"text" text NOT NULL,
	"feelings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"release_at" timestamp with time zone NOT NULL,
	"announced_at" timestamp with time zone,
	"first_pulled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "jar_notes_release_at" ON "jar_notes" USING btree ("release_at");