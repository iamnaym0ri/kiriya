CREATE TABLE "artwork_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artwork_id" uuid NOT NULL,
	"body" text NOT NULL,
	"seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "letters" ADD COLUMN "reaction" text;--> statement-breakpoint
ALTER TABLE "letters" ADD COLUMN "reacted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "love_notes" ADD COLUMN "reaction" text;--> statement-breakpoint
ALTER TABLE "love_notes" ADD COLUMN "reacted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "artwork_notes" ADD CONSTRAINT "artwork_notes_artwork_id_artworks_id_fk" FOREIGN KEY ("artwork_id") REFERENCES "public"."artworks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "artwork_notes_artwork_created" ON "artwork_notes" USING btree ("artwork_id","created_at");