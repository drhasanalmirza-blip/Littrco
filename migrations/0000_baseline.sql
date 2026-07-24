CREATE TYPE "public"."alert_severity" AS ENUM('INFO', 'WARNING', 'CRITICAL');--> statement-breakpoint
CREATE TYPE "public"."device_command_status" AS ENUM('PENDING', 'SENT', 'ACKED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."device_log_level" AS ENUM('DEBUG', 'INFO', 'WARN', 'ERROR');--> statement-breakpoint
CREATE TYPE "public"."device_status_v2" AS ENUM('PROVISIONING', 'LIVE', 'OFFLINE', 'RETIRED');--> statement-breakpoint
CREATE TYPE "public"."drop_review_status" AS ENUM('UNREVIEWED', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."drop_session_status" AS ENUM('OPEN', 'FINALIZED', 'CLAIMED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('NEW', 'CONTACTED', 'CONVERTED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."ledger_status" AS ENUM('PENDING', 'POSTED', 'VOID');--> statement-breakpoint
CREATE TYPE "public"."ledger_type" AS ENUM('EARNED', 'REDEEMED', 'ADJUST');--> statement-breakpoint
CREATE TYPE "public"."photo_reason" AS ENUM('idle', 'drop_before', 'drop_after', 'maintenance', 'calibration', 'live');--> statement-breakpoint
CREATE TYPE "public"."redemption_status" AS ENUM('PENDING', 'APPROVED', 'FULFILLED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."shop_member_role" AS ENUM('OWNER', 'MANAGER', 'VIEWER');--> statement-breakpoint
CREATE TYPE "public"."shop_status" AS ENUM('PENDING', 'VERIFIED', 'SUSPENDED');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('EARN', 'REDEEM', 'ADJUST');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('STAFF', 'PARTNER', 'CUSTOMER');--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"device_id" integer NOT NULL,
	"shop_id" integer,
	"type" text NOT NULL,
	"severity" "alert_severity" NOT NULL,
	"message" text NOT NULL,
	"data_json" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp,
	"notified_json" jsonb
);
--> statement-breakpoint
CREATE TABLE "battery_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"session_id" integer,
	"amount" integer NOT NULL,
	"type" "ledger_type" NOT NULL,
	"status" "ledger_status" DEFAULT 'POSTED' NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "battery_tx_session_uniq" UNIQUE("session_id")
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"board" text NOT NULL,
	"theme" text DEFAULT 'default' NOT NULL,
	"path" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"url" text NOT NULL,
	"sha256" text NOT NULL,
	"size_bytes" integer,
	"active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"public_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "customers_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "customers_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "device_commands" (
	"id" serial PRIMARY KEY NOT NULL,
	"device_id" integer NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb,
	"status" "device_command_status" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"acked_at" timestamp,
	"ack_result" text
);
--> statement-breakpoint
CREATE TABLE "device_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"device_id" integer NOT NULL,
	"boot_id" integer DEFAULT 0 NOT NULL,
	"seq" integer NOT NULL,
	"level" "device_log_level" DEFAULT 'INFO' NOT NULL,
	"tag" text DEFAULT '' NOT NULL,
	"msg" text NOT NULL,
	"at_device_ms" bigint,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "device_logs_dedup_uniq" UNIQUE("device_id","boot_id","seq")
);
--> statement-breakpoint
CREATE TABLE "device_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"device_id" integer NOT NULL,
	"settings_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "device_settings_device_id_unique" UNIQUE("device_id")
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" serial PRIMARY KEY NOT NULL,
	"serial" text NOT NULL,
	"label" text,
	"device_key_hash" text NOT NULL,
	"shop_id" integer,
	"partner_id" varchar,
	"status" "device_status_v2" DEFAULT 'PROVISIONING' NOT NULL,
	"firmware_version" text,
	"last_heartbeat_at" timestamp,
	"vapes_since_empty" integer DEFAULT 0 NOT NULL,
	"fill_percent" integer DEFAULT 0 NOT NULL,
	"temp_c" real,
	"temp_devices" integer,
	"temp_raw_c" real,
	"voc_raw" integer,
	"wifi_rssi" integer,
	"sd_free_mb" integer,
	"error_log" text,
	"latest_photo_url" text,
	"latest_photo_taken_at" timestamp,
	"points_per_vape_override" integer,
	"last_distance_mm" integer,
	"target_firmware_version" text,
	"hmi_version" text,
	"assets_version" text,
	"offline_notified_at" timestamp,
	"alert_state_json" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "devices_serial_unique" UNIQUE("serial"),
	CONSTRAINT "devices_device_key_hash_unique" UNIQUE("device_key_hash")
);
--> statement-breakpoint
CREATE TABLE "drop_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"device_id" integer NOT NULL,
	"shop_id" integer,
	"status" "drop_session_status" DEFAULT 'OPEN' NOT NULL,
	"offline" boolean DEFAULT false NOT NULL,
	"detected_drop_count" integer DEFAULT 0 NOT NULL,
	"accepted_drop_count" integer DEFAULT 0 NOT NULL,
	"batteries_estimated" integer DEFAULT 0 NOT NULL,
	"batteries_confirmed" integer DEFAULT 0 NOT NULL,
	"shop_points_awarded" integer DEFAULT 0 NOT NULL,
	"claim_token" text,
	"claimed_by_customer_id" integer,
	"claimed_at" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"finalized_at" timestamp,
	CONSTRAINT "drop_sessions_claim_token_unique" UNIQUE("claim_token")
);
--> statement-breakpoint
CREATE TABLE "drops" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"sequence" integer NOT NULL,
	"before_photo_id" integer,
	"after_photo_id" integer,
	"beam_pattern_json" jsonb,
	"temp_c" real,
	"voc_raw" integer,
	"fill_percent" integer,
	"accepted" boolean DEFAULT true NOT NULL,
	"review_status" "drop_review_status" DEFAULT 'UNREVIEWED' NOT NULL,
	"reviewed_by_user_id" varchar,
	"reviewed_at" timestamp,
	"review_note" text,
	"points_revoked" boolean DEFAULT false NOT NULL,
	"occurred_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "drops_session_sequence_uniq" UNIQUE("session_id","sequence")
);
--> statement-breakpoint
CREATE TABLE "firmware_releases" (
	"id" serial PRIMARY KEY NOT NULL,
	"board" text NOT NULL,
	"version" text NOT NULL,
	"channel" text DEFAULT 'stable' NOT NULL,
	"url" text NOT NULL,
	"sha256" text NOT NULL,
	"size_bytes" integer,
	"notes" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "firmware_board_version_channel_uniq" UNIQUE("board","version","channel")
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_name" text NOT NULL,
	"contact_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"address" text NOT NULL,
	"volume" text,
	"status" "lead_status" DEFAULT 'NEW' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_prefs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"shop_id" integer,
	"channels_json" jsonb DEFAULT '{"email":true,"sms":false,"call":false,"push":false}'::jsonb NOT NULL,
	"events_json" jsonb DEFAULT '{"full":true,"fillLevels":[],"fire":true,"tempHigh":true,"vocHigh":true,"offline":true,"drops":false}'::jsonb NOT NULL,
	"phone" text,
	"phones_json" jsonb,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "notification_prefs_user_shop_uniq" UNIQUE("user_id","shop_id")
);
--> statement-breakpoint
CREATE TABLE "pairing_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"device_id" integer NOT NULL,
	"created_by_user_id" varchar NOT NULL,
	"expires_at" timestamp NOT NULL,
	"consumed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pairing_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "pairing_nonces" (
	"id" serial PRIMARY KEY NOT NULL,
	"nonce" text NOT NULL,
	"device_id" integer NOT NULL,
	"expires_at" timestamp NOT NULL,
	"consumed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pairing_nonces_nonce_unique" UNIQUE("nonce")
);
--> statement-breakpoint
CREATE TABLE "partner_invites" (
	"id" serial PRIMARY KEY NOT NULL,
	"shop_id" integer NOT NULL,
	"email" text NOT NULL,
	"role" "shop_member_role" NOT NULL,
	"token" text NOT NULL,
	"invited_by_user_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"accepted_at" timestamp,
	"accepted_by_user_id" varchar,
	CONSTRAINT "partner_invites_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "photos" (
	"id" serial PRIMARY KEY NOT NULL,
	"device_id" integer NOT NULL,
	"session_id" integer,
	"drop_id" integer,
	"storage_url" text NOT NULL,
	"reason" "photo_reason" DEFAULT 'idle' NOT NULL,
	"taken_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pickup_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"shop_id" integer NOT NULL,
	"requested_by_id" varchar NOT NULL,
	"notes" text,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"scheduled_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "redemptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"store_item_id" integer NOT NULL,
	"points_spent" integer NOT NULL,
	"status" "redemption_status" DEFAULT 'PENDING' NOT NULL,
	"fulfilled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reward_configs" (
	"id" serial PRIMARY KEY NOT NULL,
	"shop_id" integer NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"batteries_per_vape" integer DEFAULT 5 NOT NULL,
	"shop_points_per_vape" integer DEFAULT 1 NOT NULL,
	"session_window_sec" integer DEFAULT 60 NOT NULL,
	"claim_expiry_sec" integer DEFAULT 604800 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "reward_configs_shop_id_unique" UNIQUE("shop_id")
);
--> statement-breakpoint
CREATE TABLE "self_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"customer_id" integer NOT NULL,
	"brand" text,
	"model" text,
	"puff_count" integer,
	"is_thc" boolean,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "self_reports_session_uniq" UNIQUE("session_id")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shop_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"shop_id" integer NOT NULL,
	"role" "shop_member_role" DEFAULT 'MANAGER' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "shop_members_user_id_shop_id_unique" UNIQUE("user_id","shop_id")
);
--> statement-breakpoint
CREATE TABLE "shop_point_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"shop_id" integer NOT NULL,
	"device_id" integer,
	"session_id" integer,
	"amount" integer NOT NULL,
	"type" "ledger_type" NOT NULL,
	"status" "ledger_status" DEFAULT 'POSTED' NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shop_reward_redemptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"shop_id" integer NOT NULL,
	"reward_id" integer NOT NULL,
	"redeemed_by_user_id" varchar NOT NULL,
	"cost" integer NOT NULL,
	"redeemed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shop_rewards" (
	"id" serial PRIMARY KEY NOT NULL,
	"shop_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"cost" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shops" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"city" text NOT NULL,
	"service_area" text NOT NULL,
	"phone" text,
	"secret_pin" text,
	"latitude" double precision,
	"longitude" double precision,
	"status" "shop_status" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"points_cost" integer NOT NULL,
	"image_url" text,
	"category" text DEFAULT 'customer' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"stock" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"wallet_id" integer NOT NULL,
	"amount" integer NOT NULL,
	"type" "transaction_type" NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"role" "user_role" DEFAULT 'CUSTOMER' NOT NULL,
	"theme_preference" text DEFAULT 'light',
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "volunteers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"interest" text NOT NULL,
	"availability" text NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"points_balance" integer DEFAULT 0 NOT NULL,
	"lifetime_earned" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wallets_customer_id_unique" UNIQUE("customer_id")
);
--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battery_transactions" ADD CONSTRAINT "battery_transactions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battery_transactions" ADD CONSTRAINT "battery_transactions_session_id_drop_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."drop_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_commands" ADD CONSTRAINT "device_commands_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_logs" ADD CONSTRAINT "device_logs_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_settings" ADD CONSTRAINT "device_settings_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_partner_id_users_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drop_sessions" ADD CONSTRAINT "drop_sessions_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drop_sessions" ADD CONSTRAINT "drop_sessions_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drop_sessions" ADD CONSTRAINT "drop_sessions_claimed_by_customer_id_customers_id_fk" FOREIGN KEY ("claimed_by_customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drops" ADD CONSTRAINT "drops_session_id_drop_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."drop_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drops" ADD CONSTRAINT "drops_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_prefs" ADD CONSTRAINT "notification_prefs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_prefs" ADD CONSTRAINT "notification_prefs_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pairing_codes" ADD CONSTRAINT "pairing_codes_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pairing_codes" ADD CONSTRAINT "pairing_codes_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pairing_nonces" ADD CONSTRAINT "pairing_nonces_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_invites" ADD CONSTRAINT "partner_invites_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_invites" ADD CONSTRAINT "partner_invites_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_invites" ADD CONSTRAINT "partner_invites_accepted_by_user_id_users_id_fk" FOREIGN KEY ("accepted_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_session_id_drop_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."drop_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_drop_id_drops_id_fk" FOREIGN KEY ("drop_id") REFERENCES "public"."drops"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pickup_requests" ADD CONSTRAINT "pickup_requests_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pickup_requests" ADD CONSTRAINT "pickup_requests_requested_by_id_users_id_fk" FOREIGN KEY ("requested_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_store_item_id_store_items_id_fk" FOREIGN KEY ("store_item_id") REFERENCES "public"."store_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_configs" ADD CONSTRAINT "reward_configs_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "self_reports" ADD CONSTRAINT "self_reports_session_id_drop_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."drop_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "self_reports" ADD CONSTRAINT "self_reports_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_members" ADD CONSTRAINT "shop_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_members" ADD CONSTRAINT "shop_members_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_point_transactions" ADD CONSTRAINT "shop_point_transactions_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_point_transactions" ADD CONSTRAINT "shop_point_transactions_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_point_transactions" ADD CONSTRAINT "shop_point_transactions_session_id_drop_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."drop_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_reward_redemptions" ADD CONSTRAINT "shop_reward_redemptions_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_reward_redemptions" ADD CONSTRAINT "shop_reward_redemptions_reward_id_shop_rewards_id_fk" FOREIGN KEY ("reward_id") REFERENCES "public"."shop_rewards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_reward_redemptions" ADD CONSTRAINT "shop_reward_redemptions_redeemed_by_user_id_users_id_fk" FOREIGN KEY ("redeemed_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_rewards" ADD CONSTRAINT "shop_rewards_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alerts_device_created_idx" ON "alerts" USING btree ("device_id","created_at");--> statement-breakpoint
CREATE INDEX "battery_tx_customer_idx" ON "battery_transactions" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "content_files_board_theme_idx" ON "content_files" USING btree ("board","theme");--> statement-breakpoint
CREATE INDEX "device_commands_device_idx" ON "device_commands" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "device_logs_device_idx" ON "device_logs" USING btree ("device_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_prefs_user_global_uniq" ON "notification_prefs" USING btree ("user_id") WHERE "notification_prefs"."shop_id" is null;--> statement-breakpoint
CREATE INDEX "shop_pt_shop_idx" ON "shop_point_transactions" USING btree ("shop_id");