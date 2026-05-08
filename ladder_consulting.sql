-- MySQL dump 10.13  Distrib 8.0.42, for macos15 (arm64)
--
-- Host: localhost    Database: ladder_consulting
-- ------------------------------------------------------
-- Server version	8.0.43

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `admin_logs`
--

DROP TABLE IF EXISTS `admin_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `admin_logs` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `admin_id` int unsigned NOT NULL,
  `action` varchar(200) NOT NULL,
  `entity_type` varchar(100) DEFAULT NULL,
  `entity_id` int unsigned DEFAULT NULL,
  `old_value` json DEFAULT NULL,
  `new_value` json DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_al_admin` (`admin_id`),
  CONSTRAINT `fk_al_admin` FOREIGN KEY (`admin_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `admin_logs`
--

LOCK TABLES `admin_logs` WRITE;
/*!40000 ALTER TABLE `admin_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `admin_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `applications`
--

DROP TABLE IF EXISTS `applications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `applications` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `candidate_id` int unsigned NOT NULL,
  `job_id` int unsigned NOT NULL,
  `resume_id` int unsigned NOT NULL,
  `cover_letter` text,
  `status` enum('applied','under_review','shortlisted','interview_scheduled','interviewed','offer_sent','hired','rejected','withdrawn') DEFAULT 'applied',
  `applied_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_application` (`candidate_id`,`job_id`),
  KEY `fk_app_job` (`job_id`),
  KEY `fk_app_resume` (`resume_id`),
  CONSTRAINT `fk_app_candidate` FOREIGN KEY (`candidate_id`) REFERENCES `candidates` (`id`),
  CONSTRAINT `fk_app_job` FOREIGN KEY (`job_id`) REFERENCES `job_postings` (`id`),
  CONSTRAINT `fk_app_resume` FOREIGN KEY (`resume_id`) REFERENCES `resumes` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `applications`
--

LOCK TABLES `applications` WRITE;
/*!40000 ALTER TABLE `applications` DISABLE KEYS */;
/*!40000 ALTER TABLE `applications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `call_logs`
--

DROP TABLE IF EXISTS `call_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `call_logs` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `lead_id` int unsigned NOT NULL,
  `employee_id` int unsigned NOT NULL,
  `called_at` datetime NOT NULL,
  `duration_secs` int DEFAULT '0',
  `outcome` enum('no_answer','voicemail','callback_scheduled','interested','not_interested','converted') NOT NULL,
  `notes` text,
  `callback_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_cl_lead` (`lead_id`),
  KEY `fk_cl_emp` (`employee_id`),
  CONSTRAINT `fk_cl_emp` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`),
  CONSTRAINT `fk_cl_lead` FOREIGN KEY (`lead_id`) REFERENCES `leads` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `call_logs`
--

LOCK TABLES `call_logs` WRITE;
/*!40000 ALTER TABLE `call_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `call_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `candidate_profiles`
--

DROP TABLE IF EXISTS `candidate_profiles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `candidate_profiles` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `candidate_id` int unsigned NOT NULL,
  `headline` varchar(255) DEFAULT NULL,
  `summary` text,
  `total_experience` decimal(4,1) DEFAULT '0.0',
  `current_location` varchar(150) DEFAULT NULL,
  `preferred_locations` varchar(500) DEFAULT NULL,
  `expected_salary` decimal(12,2) DEFAULT NULL,
  `current_salary` decimal(12,2) DEFAULT NULL,
  `notice_period_days` int DEFAULT '0',
  `linkedin_url` varchar(500) DEFAULT NULL,
  `portfolio_url` varchar(500) DEFAULT NULL,
  `education` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `candidate_id` (`candidate_id`),
  CONSTRAINT `fk_cp_candidate` FOREIGN KEY (`candidate_id`) REFERENCES `candidates` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `candidate_profiles`
--

LOCK TABLES `candidate_profiles` WRITE;
/*!40000 ALTER TABLE `candidate_profiles` DISABLE KEYS */;
/*!40000 ALTER TABLE `candidate_profiles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `candidate_skill_vectors`
--

DROP TABLE IF EXISTS `candidate_skill_vectors`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `candidate_skill_vectors` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `candidate_id` int unsigned NOT NULL,
  `skill_tag_id` int unsigned NOT NULL,
  `proficiency` enum('beginner','intermediate','advanced','expert') DEFAULT 'intermediate',
  `years_exp` decimal(4,1) DEFAULT '0.0',
  `source` enum('manual','resume_parsed','ai_inferred') DEFAULT 'manual',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_cand_skill` (`candidate_id`,`skill_tag_id`),
  KEY `fk_csv_skill` (`skill_tag_id`),
  CONSTRAINT `fk_csv_candidate` FOREIGN KEY (`candidate_id`) REFERENCES `candidates` (`id`),
  CONSTRAINT `fk_csv_skill` FOREIGN KEY (`skill_tag_id`) REFERENCES `skill_tags` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `candidate_skill_vectors`
--

LOCK TABLES `candidate_skill_vectors` WRITE;
/*!40000 ALTER TABLE `candidate_skill_vectors` DISABLE KEYS */;
/*!40000 ALTER TABLE `candidate_skill_vectors` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `candidates`
--

DROP TABLE IF EXISTS `candidates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `candidates` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int unsigned NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_id` (`user_id`),
  CONSTRAINT `fk_cand_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `candidates`
--

LOCK TABLES `candidates` WRITE;
/*!40000 ALTER TABLE `candidates` DISABLE KEYS */;
/*!40000 ALTER TABLE `candidates` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `certificates`
--

DROP TABLE IF EXISTS `certificates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `certificates` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `hired_employee_id` int unsigned NOT NULL,
  `course_id` int unsigned NOT NULL,
  `assignment_id` int unsigned NOT NULL,
  `certificate_key` varchar(500) DEFAULT NULL,
  `issued_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `expires_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `assignment_id` (`assignment_id`),
  KEY `fk_cert_he` (`hired_employee_id`),
  KEY `fk_cert_course` (`course_id`),
  CONSTRAINT `fk_cert_assign` FOREIGN KEY (`assignment_id`) REFERENCES `training_assignments` (`id`),
  CONSTRAINT `fk_cert_course` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`),
  CONSTRAINT `fk_cert_he` FOREIGN KEY (`hired_employee_id`) REFERENCES `hired_employees` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `certificates`
--

LOCK TABLES `certificates` WRITE;
/*!40000 ALTER TABLE `certificates` DISABLE KEYS */;
/*!40000 ALTER TABLE `certificates` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `companies`
--

DROP TABLE IF EXISTS `companies`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `companies` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int unsigned NOT NULL,
  `company_name` varchar(200) NOT NULL,
  `industry` varchar(100) DEFAULT NULL,
  `size` enum('1-10','11-50','51-200','201-500','500+') DEFAULT NULL,
  `website` varchar(500) DEFAULT NULL,
  `logo_key` varchar(500) DEFAULT NULL,
  `headquarters` varchar(150) DEFAULT NULL,
  `description` text,
  `is_approved` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_id` (`user_id`),
  CONSTRAINT `fk_comp_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `companies`
--

LOCK TABLES `companies` WRITE;
/*!40000 ALTER TABLE `companies` DISABLE KEYS */;
/*!40000 ALTER TABLE `companies` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `company_approvals`
--

DROP TABLE IF EXISTS `company_approvals`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `company_approvals` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int unsigned NOT NULL,
  `status` enum('pending','approved','rejected') DEFAULT 'pending',
  `reviewed_by` int unsigned DEFAULT NULL,
  `review_note` text,
  `reviewed_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_ca_user` (`user_id`),
  KEY `fk_ca_admin` (`reviewed_by`),
  CONSTRAINT `fk_ca_admin` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_ca_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `company_approvals`
--

LOCK TABLES `company_approvals` WRITE;
/*!40000 ALTER TABLE `company_approvals` DISABLE KEYS */;
/*!40000 ALTER TABLE `company_approvals` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `courses`
--

DROP TABLE IF EXISTS `courses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `courses` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `created_by` int unsigned NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text,
  `thumbnail_key` varchar(500) DEFAULT NULL,
  `skill_tag_id` int unsigned DEFAULT NULL,
  `level` enum('beginner','intermediate','advanced') DEFAULT 'beginner',
  `duration_hrs` decimal(5,1) DEFAULT NULL,
  `is_published` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_course_trainer` (`created_by`),
  KEY `fk_course_skill` (`skill_tag_id`),
  CONSTRAINT `fk_course_skill` FOREIGN KEY (`skill_tag_id`) REFERENCES `skill_tags` (`id`),
  CONSTRAINT `fk_course_trainer` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `courses`
--

LOCK TABLES `courses` WRITE;
/*!40000 ALTER TABLE `courses` DISABLE KEYS */;
/*!40000 ALTER TABLE `courses` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `employees`
--

DROP TABLE IF EXISTS `employees`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `employees` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int unsigned NOT NULL,
  `employee_code` varchar(50) DEFAULT NULL,
  `department` varchar(100) DEFAULT NULL,
  `designation` varchar(100) DEFAULT NULL,
  `date_joined` date DEFAULT NULL,
  `manager_id` int unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `employee_code` (`employee_code`),
  KEY `fk_emp_user` (`user_id`),
  KEY `fk_emp_manager` (`manager_id`),
  CONSTRAINT `fk_emp_manager` FOREIGN KEY (`manager_id`) REFERENCES `employees` (`id`),
  CONSTRAINT `fk_emp_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `employees`
--

LOCK TABLES `employees` WRITE;
/*!40000 ALTER TABLE `employees` DISABLE KEYS */;
/*!40000 ALTER TABLE `employees` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `hired_employees`
--

DROP TABLE IF EXISTS `hired_employees`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `hired_employees` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `candidate_id` int unsigned NOT NULL,
  `company_id` int unsigned NOT NULL,
  `application_id` int unsigned NOT NULL,
  `offer_id` int unsigned NOT NULL,
  `employee_id` int unsigned DEFAULT NULL,
  `joining_date` date DEFAULT NULL,
  `role_title` varchar(150) DEFAULT NULL,
  `department` varchar(100) DEFAULT NULL,
  `onboarding_started` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `application_id` (`application_id`),
  UNIQUE KEY `offer_id` (`offer_id`),
  KEY `fk_he_candidate` (`candidate_id`),
  KEY `fk_he_company` (`company_id`),
  CONSTRAINT `fk_he_app` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`),
  CONSTRAINT `fk_he_candidate` FOREIGN KEY (`candidate_id`) REFERENCES `candidates` (`id`),
  CONSTRAINT `fk_he_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`),
  CONSTRAINT `fk_he_offer` FOREIGN KEY (`offer_id`) REFERENCES `offers` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `hired_employees`
--

LOCK TABLES `hired_employees` WRITE;
/*!40000 ALTER TABLE `hired_employees` DISABLE KEYS */;
/*!40000 ALTER TABLE `hired_employees` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `interview_outcomes`
--

DROP TABLE IF EXISTS `interview_outcomes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `interview_outcomes` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `interview_id` int unsigned NOT NULL,
  `recorded_by` int unsigned NOT NULL,
  `result` enum('selected','hold','rejected') NOT NULL,
  `feedback` text,
  `rating` tinyint unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `interview_id` (`interview_id`),
  KEY `fk_io_user` (`recorded_by`),
  CONSTRAINT `fk_io_interview` FOREIGN KEY (`interview_id`) REFERENCES `interview_slots` (`id`),
  CONSTRAINT `fk_io_user` FOREIGN KEY (`recorded_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `interview_outcomes`
--

LOCK TABLES `interview_outcomes` WRITE;
/*!40000 ALTER TABLE `interview_outcomes` DISABLE KEYS */;
/*!40000 ALTER TABLE `interview_outcomes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `interview_slots`
--

DROP TABLE IF EXISTS `interview_slots`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `interview_slots` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `application_id` int unsigned NOT NULL,
  `scheduled_by` int unsigned NOT NULL,
  `slot_datetime` datetime NOT NULL,
  `duration_mins` int DEFAULT '60',
  `mode` enum('video','phone','in_person') DEFAULT 'video',
  `meeting_link` varchar(500) DEFAULT NULL,
  `location_detail` varchar(500) DEFAULT NULL,
  `status` enum('proposed','confirmed','rescheduled','completed','cancelled') DEFAULT 'proposed',
  `candidate_confirmed` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_is_app` (`application_id`),
  KEY `fk_is_user` (`scheduled_by`),
  CONSTRAINT `fk_is_app` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`),
  CONSTRAINT `fk_is_user` FOREIGN KEY (`scheduled_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `interview_slots`
--

LOCK TABLES `interview_slots` WRITE;
/*!40000 ALTER TABLE `interview_slots` DISABLE KEYS */;
/*!40000 ALTER TABLE `interview_slots` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `job_postings`
--

DROP TABLE IF EXISTS `job_postings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `job_postings` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `company_id` int unsigned NOT NULL,
  `posted_by` int unsigned NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text NOT NULL,
  `requirements` text,
  `location` varchar(150) DEFAULT NULL,
  `job_type` enum('full_time','part_time','contract','internship') DEFAULT 'full_time',
  `work_mode` enum('onsite','remote','hybrid') DEFAULT 'onsite',
  `salary_min` decimal(12,2) DEFAULT NULL,
  `salary_max` decimal(12,2) DEFAULT NULL,
  `experience_min` decimal(4,1) DEFAULT '0.0',
  `experience_max` decimal(4,1) DEFAULT NULL,
  `status` enum('draft','active','paused','closed') DEFAULT 'draft',
  `ai_processed` tinyint(1) DEFAULT '0',
  `openings` int DEFAULT '1',
  `deadline` date DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_jp_company` (`company_id`),
  KEY `fk_jp_user` (`posted_by`),
  CONSTRAINT `fk_jp_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`),
  CONSTRAINT `fk_jp_user` FOREIGN KEY (`posted_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `job_postings`
--

LOCK TABLES `job_postings` WRITE;
/*!40000 ALTER TABLE `job_postings` DISABLE KEYS */;
/*!40000 ALTER TABLE `job_postings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `job_skill_vectors`
--

DROP TABLE IF EXISTS `job_skill_vectors`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `job_skill_vectors` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `job_id` int unsigned NOT NULL,
  `skill_tag_id` int unsigned NOT NULL,
  `weight` decimal(4,3) DEFAULT '1.000',
  `is_mandatory` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_job_skill` (`job_id`,`skill_tag_id`),
  KEY `fk_jsv_skill` (`skill_tag_id`),
  CONSTRAINT `fk_jsv_job` FOREIGN KEY (`job_id`) REFERENCES `job_postings` (`id`),
  CONSTRAINT `fk_jsv_skill` FOREIGN KEY (`skill_tag_id`) REFERENCES `skill_tags` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `job_skill_vectors`
--

LOCK TABLES `job_skill_vectors` WRITE;
/*!40000 ALTER TABLE `job_skill_vectors` DISABLE KEYS */;
/*!40000 ALTER TABLE `job_skill_vectors` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `leads`
--

DROP TABLE IF EXISTS `leads`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `leads` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `assigned_to` int unsigned NOT NULL,
  `company_name` varchar(200) NOT NULL,
  `contact_name` varchar(150) DEFAULT NULL,
  `contact_email` varchar(191) DEFAULT NULL,
  `contact_phone` varchar(20) DEFAULT NULL,
  `source` varchar(100) DEFAULT NULL,
  `stage` enum('new','contacted','interested','proposal','converted','lost') DEFAULT 'new',
  `notes` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_leads_emp` (`assigned_to`),
  CONSTRAINT `fk_leads_emp` FOREIGN KEY (`assigned_to`) REFERENCES `employees` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `leads`
--

LOCK TABLES `leads` WRITE;
/*!40000 ALTER TABLE `leads` DISABLE KEYS */;
/*!40000 ALTER TABLE `leads` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `match_results`
--

DROP TABLE IF EXISTS `match_results`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `match_results` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `application_id` int unsigned NOT NULL,
  `fit_score` decimal(5,2) NOT NULL,
  `matched_skills` json DEFAULT NULL,
  `missing_skills` json DEFAULT NULL,
  `ai_summary` text,
  `model_version` varchar(50) DEFAULT NULL,
  `computed_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `application_id` (`application_id`),
  CONSTRAINT `fk_mr_app` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `match_results`
--

LOCK TABLES `match_results` WRITE;
/*!40000 ALTER TABLE `match_results` DISABLE KEYS */;
/*!40000 ALTER TABLE `match_results` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `module_progress`
--

DROP TABLE IF EXISTS `module_progress`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `module_progress` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `assignment_id` int unsigned NOT NULL,
  `module_id` int unsigned NOT NULL,
  `status` enum('not_started','in_progress','completed','failed') DEFAULT 'not_started',
  `score` tinyint unsigned DEFAULT NULL,
  `attempts` tinyint DEFAULT '0',
  `completed_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_mp` (`assignment_id`,`module_id`),
  KEY `fk_mp_module` (`module_id`),
  CONSTRAINT `fk_mp_assignment` FOREIGN KEY (`assignment_id`) REFERENCES `training_assignments` (`id`),
  CONSTRAINT `fk_mp_module` FOREIGN KEY (`module_id`) REFERENCES `modules` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `module_progress`
--

LOCK TABLES `module_progress` WRITE;
/*!40000 ALTER TABLE `module_progress` DISABLE KEYS */;
/*!40000 ALTER TABLE `module_progress` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `modules`
--

DROP TABLE IF EXISTS `modules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `modules` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `course_id` int unsigned NOT NULL,
  `title` varchar(255) NOT NULL,
  `content_type` enum('video','pdf','article','quiz') NOT NULL,
  `content_key` varchar(500) DEFAULT NULL,
  `content_url` varchar(1000) DEFAULT NULL,
  `order_index` int DEFAULT '0',
  `duration_mins` int DEFAULT '0',
  `pass_score` tinyint DEFAULT '70',
  `is_published` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_mod_course` (`course_id`),
  CONSTRAINT `fk_mod_course` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `modules`
--

LOCK TABLES `modules` WRITE;
/*!40000 ALTER TABLE `modules` DISABLE KEYS */;
/*!40000 ALTER TABLE `modules` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notifications`
--

DROP TABLE IF EXISTS `notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notifications` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int unsigned NOT NULL,
  `type` varchar(100) NOT NULL,
  `title` varchar(255) NOT NULL,
  `body` text,
  `is_read` tinyint(1) DEFAULT '0',
  `metadata` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_notif_user` (`user_id`),
  CONSTRAINT `fk_notif_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notifications`
--

LOCK TABLES `notifications` WRITE;
/*!40000 ALTER TABLE `notifications` DISABLE KEYS */;
/*!40000 ALTER TABLE `notifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `offers`
--

DROP TABLE IF EXISTS `offers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `offers` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `application_id` int unsigned NOT NULL,
  `issued_by` int unsigned NOT NULL,
  `offer_letter_key` varchar(500) DEFAULT NULL,
  `ctc` decimal(12,2) DEFAULT NULL,
  `joining_date` date DEFAULT NULL,
  `valid_until` date DEFAULT NULL,
  `status` enum('sent','accepted','declined','expired','withdrawn') DEFAULT 'sent',
  `candidate_response_at` datetime DEFAULT NULL,
  `notes` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `application_id` (`application_id`),
  KEY `fk_offer_user` (`issued_by`),
  CONSTRAINT `fk_offer_app` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`),
  CONSTRAINT `fk_offer_user` FOREIGN KEY (`issued_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `offers`
--

LOCK TABLES `offers` WRITE;
/*!40000 ALTER TABLE `offers` DISABLE KEYS */;
/*!40000 ALTER TABLE `offers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `platform_settings`
--

DROP TABLE IF EXISTS `platform_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `platform_settings` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `setting_key` varchar(150) NOT NULL,
  `value` text NOT NULL,
  `description` varchar(500) DEFAULT NULL,
  `updated_by` int unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `setting_key` (`setting_key`),
  KEY `fk_ps_admin` (`updated_by`),
  CONSTRAINT `fk_ps_admin` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `platform_settings`
--

LOCK TABLES `platform_settings` WRITE;
/*!40000 ALTER TABLE `platform_settings` DISABLE KEYS */;
INSERT INTO `platform_settings` VALUES (1,'platform_name','Ladder Consulting','Display name of the platform',NULL,'2026-05-07 18:26:36','2026-05-07 18:26:36'),(2,'support_email','support@ladderconsulting.in','Support contact email',NULL,'2026-05-07 18:26:36','2026-05-07 18:26:36'),(3,'max_resume_size_mb','5','Max resume upload size in MB',NULL,'2026-05-07 18:26:36','2026-05-07 18:26:36'),(4,'ai_match_threshold','40','Minimum fit score to appear in shortlist',NULL,'2026-05-07 18:26:36','2026-05-07 18:26:36'),(5,'offer_validity_days','7','Default days before offer expires',NULL,'2026-05-07 18:26:36','2026-05-07 18:26:36'),(6,'email_verify_required','true','Whether email verification is mandatory',NULL,'2026-05-07 18:26:36','2026-05-07 18:26:36');
/*!40000 ALTER TABLE `platform_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `rejection_feedback`
--

DROP TABLE IF EXISTS `rejection_feedback`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `rejection_feedback` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `application_id` int unsigned NOT NULL,
  `rejected_by` int unsigned NOT NULL,
  `reason_code` varchar(100) DEFAULT NULL,
  `reason_text` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_rf_app` (`application_id`),
  KEY `fk_rf_user` (`rejected_by`),
  CONSTRAINT `fk_rf_app` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`),
  CONSTRAINT `fk_rf_user` FOREIGN KEY (`rejected_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `rejection_feedback`
--

LOCK TABLES `rejection_feedback` WRITE;
/*!40000 ALTER TABLE `rejection_feedback` DISABLE KEYS */;
/*!40000 ALTER TABLE `rejection_feedback` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `resumes`
--

DROP TABLE IF EXISTS `resumes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `resumes` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `candidate_id` int unsigned NOT NULL,
  `file_key` varchar(500) NOT NULL,
  `file_name` varchar(255) DEFAULT NULL,
  `file_size` int DEFAULT NULL,
  `mime_type` varchar(100) DEFAULT NULL,
  `parsed_text` longtext,
  `parse_status` enum('pending','processing','done','failed') DEFAULT 'pending',
  `is_primary` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_res_candidate` (`candidate_id`),
  CONSTRAINT `fk_res_candidate` FOREIGN KEY (`candidate_id`) REFERENCES `candidates` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `resumes`
--

LOCK TABLES `resumes` WRITE;
/*!40000 ALTER TABLE `resumes` DISABLE KEYS */;
/*!40000 ALTER TABLE `resumes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `role_benchmarks`
--

DROP TABLE IF EXISTS `role_benchmarks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `role_benchmarks` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `role_title` varchar(150) NOT NULL,
  `skill_tag_id` int unsigned NOT NULL,
  `min_level` enum('beginner','intermediate','advanced','expert') DEFAULT 'intermediate',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_rb_skill` (`skill_tag_id`),
  CONSTRAINT `fk_rb_skill` FOREIGN KEY (`skill_tag_id`) REFERENCES `skill_tags` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `role_benchmarks`
--

LOCK TABLES `role_benchmarks` WRITE;
/*!40000 ALTER TABLE `role_benchmarks` DISABLE KEYS */;
/*!40000 ALTER TABLE `role_benchmarks` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `roles`
--

DROP TABLE IF EXISTS `roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `roles` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(50) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `roles`
--

LOCK TABLES `roles` WRITE;
/*!40000 ALTER TABLE `roles` DISABLE KEYS */;
INSERT INTO `roles` VALUES (1,'admin','Full platform control — Ladder internal superuser','2026-05-07 18:26:36','2026-05-08 08:38:01'),(2,'hr_staff','Internal HR and recruitment operations team','2026-05-07 18:26:36','2026-05-07 18:26:36'),(3,'company','Company account — job postings, hiring, interviews','2026-05-07 18:26:36','2026-05-08 08:38:01'),(4,'candidate','Job seeker — profile, apply, training','2026-05-07 18:26:36','2026-05-07 18:26:36'),(5,'trainer','Content manager — upload and manage training material','2026-05-07 18:26:36','2026-05-07 18:26:36');
/*!40000 ALTER TABLE `roles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `shortlists`
--

DROP TABLE IF EXISTS `shortlists`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `shortlists` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `application_id` int unsigned NOT NULL,
  `shortlisted_by` int unsigned NOT NULL,
  `fit_score` decimal(5,2) DEFAULT NULL,
  `notes` text,
  `status` enum('shortlisted','rejected') DEFAULT 'shortlisted',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `application_id` (`application_id`),
  KEY `fk_sl_user` (`shortlisted_by`),
  CONSTRAINT `fk_sl_app` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`),
  CONSTRAINT `fk_sl_user` FOREIGN KEY (`shortlisted_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `shortlists`
--

LOCK TABLES `shortlists` WRITE;
/*!40000 ALTER TABLE `shortlists` DISABLE KEYS */;
/*!40000 ALTER TABLE `shortlists` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `skill_tags`
--

DROP TABLE IF EXISTS `skill_tags`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `skill_tags` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `category` varchar(100) DEFAULT NULL,
  `aliases` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `skill_tags`
--

LOCK TABLES `skill_tags` WRITE;
/*!40000 ALTER TABLE `skill_tags` DISABLE KEYS */;
/*!40000 ALTER TABLE `skill_tags` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `task_notes`
--

DROP TABLE IF EXISTS `task_notes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `task_notes` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `task_id` int unsigned NOT NULL,
  `author_id` int unsigned NOT NULL,
  `note` text NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_tn_task` (`task_id`),
  KEY `fk_tn_author` (`author_id`),
  CONSTRAINT `fk_tn_author` FOREIGN KEY (`author_id`) REFERENCES `employees` (`id`),
  CONSTRAINT `fk_tn_task` FOREIGN KEY (`task_id`) REFERENCES `tasks` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `task_notes`
--

LOCK TABLES `task_notes` WRITE;
/*!40000 ALTER TABLE `task_notes` DISABLE KEYS */;
/*!40000 ALTER TABLE `task_notes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tasks`
--

DROP TABLE IF EXISTS `tasks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tasks` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `assigned_to` int unsigned NOT NULL,
  `assigned_by` int unsigned NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text,
  `priority` enum('low','medium','high','urgent') DEFAULT 'medium',
  `status` enum('pending','in_progress','completed','cancelled') DEFAULT 'pending',
  `due_date` date DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_task_to` (`assigned_to`),
  KEY `fk_task_by` (`assigned_by`),
  CONSTRAINT `fk_task_by` FOREIGN KEY (`assigned_by`) REFERENCES `employees` (`id`),
  CONSTRAINT `fk_task_to` FOREIGN KEY (`assigned_to`) REFERENCES `employees` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tasks`
--

LOCK TABLES `tasks` WRITE;
/*!40000 ALTER TABLE `tasks` DISABLE KEYS */;
/*!40000 ALTER TABLE `tasks` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `training_assignments`
--

DROP TABLE IF EXISTS `training_assignments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `training_assignments` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `hired_employee_id` int unsigned NOT NULL,
  `course_id` int unsigned NOT NULL,
  `assigned_by` int unsigned DEFAULT NULL,
  `assignment_type` enum('onboarding','skill_gap','recommended','mandatory') DEFAULT 'onboarding',
  `due_date` date DEFAULT NULL,
  `status` enum('assigned','in_progress','completed','overdue') DEFAULT 'assigned',
  `completed_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ta` (`hired_employee_id`,`course_id`),
  KEY `fk_ta_course` (`course_id`),
  CONSTRAINT `fk_ta_course` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`),
  CONSTRAINT `fk_ta_he` FOREIGN KEY (`hired_employee_id`) REFERENCES `hired_employees` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `training_assignments`
--

LOCK TABLES `training_assignments` WRITE;
/*!40000 ALTER TABLE `training_assignments` DISABLE KEYS */;
/*!40000 ALTER TABLE `training_assignments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `role_id` int unsigned NOT NULL,
  `name` varchar(100) NOT NULL,
  `email` varchar(191) NOT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `password` varchar(255) NOT NULL,
  `is_email_verified` tinyint(1) DEFAULT '0',
  `email_verify_token` varchar(255) DEFAULT NULL,
  `email_verify_token_expires` datetime DEFAULT NULL,
  `reset_password_token` varchar(255) DEFAULT NULL,
  `reset_password_expires` datetime DEFAULT NULL,
  `status` enum('active','pending','suspended') DEFAULT 'active',
  `last_login_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  KEY `fk_users_role` (`role_id`),
  CONSTRAINT `fk_users_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,4,'Nachiketh M Desai','nachichintu@gmail.com',NULL,'$2b$12$bAtvGlFmRvXOF/u3gzfMK.niWdYID6TVy7aqrzA018vmtbsTz7Biq',1,NULL,NULL,NULL,NULL,'active',NULL,'2026-05-08 09:11:59','2026-05-08 09:11:59',NULL),(2,2,'Test User','test@test.com',NULL,'$2b$12$yeEEqHO9mlFvcgBO5ZTsh.lX.IGBxHxZXy9Xbzt38J.3C9oxoIoUK',1,NULL,NULL,NULL,NULL,'active',NULL,'2026-05-08 09:14:30','2026-05-08 09:14:30',NULL),(3,2,'Mahua','mahua@test.com',NULL,'$2b$12$Q.Qlhq1OFDDiXUIRJu7anuy.KOYPF9AEh73RzwfJFttasv5EmUFPO',1,NULL,NULL,NULL,NULL,'active',NULL,'2026-05-08 15:42:37','2026-05-08 15:42:37',NULL),(4,3,'Nachiketh Desai','nachiketh.desai@milarch.in',NULL,'$2b$12$RGwzppUTvc/M7UUN.Nlel.dUdeWIScpI.ehwVYpl3nYJJ4acMFMDG',1,NULL,NULL,NULL,NULL,'pending',NULL,'2026-05-08 15:43:34','2026-05-08 15:43:34',NULL),(5,1,'Ladder Admin','admin@ladder.com',NULL,'$2b$12$X9kFmZqxD3kbqt3NDbuXkOMM0/0zXHziT9Dam3biUJBrc4yAYTJQO',1,NULL,NULL,NULL,NULL,'active',NULL,'2026-05-08 17:38:04','2026-05-08 17:38:04',NULL);
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-05-08 23:11:22
