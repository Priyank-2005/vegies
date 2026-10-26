ALTER TABLE "notification" ADD COLUMN "attempts" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "notification" ADD COLUMN "body" text;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_once_uq" ON "notification" USING btree ("order_id","template","channel") WHERE "notification"."order_id" is not null;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_status" CHECK ("notification"."status" in ('QUEUED','SENT','FAILED','SKIPPED'));