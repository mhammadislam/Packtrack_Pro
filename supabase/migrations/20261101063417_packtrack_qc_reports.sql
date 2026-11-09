/*
# Quality Control reports (qc_reports)

Plain English: adds a table where QC officers record one quality check per job. Each report stores
the job details, the measured QC parameters, the sample and defect counts, and the defect photo and
officer signature. Defect percentage and grade are calculated automatically by the database, so they
can never disagree with the counts.

1. New Sequence
- `qc_report_seq`: numbers reports QC-00001, QC-00002, and so on.

2. New Tables
- `qc_reports`: one row per QC check.
  - Job details: report_date, shift (A/B/C), machine_no, operator_name, job_card_no, customer_name,
    film_structure.
  - QC parameters: gsm_check, micron, seal_strength_n, peel_test (Pass/Fail), lamination_bond_strength,
    corona_dyne, registration_check (Pass/Fail), color_delta_e, bag_check (Pass/Fail), leak_test (Pass/Fail).
  - Sampling: sample_qty, defective_qty, defect_type.
  - Automatic: defect_pct = defective_qty / sample_qty * 100; grade = A (below 2%), B (2% to 5%),
    Rejected (above 5%).
  - Decision: status (Approved / Hold / Rejected).
  - Evidence: defect_image_path (file in the qc-attachments bucket), signature_data (officer signature
    image), officer_name, notes.
  - Audit: report_no (auto-numbered), created_by, created_at, updated_at.

3. New Storage Bucket
- `qc-attachments`: public read so defect photos can be shown on certificates; uploads limited to
  active users, deletes limited to administrators.

4. Security
- Row level security is enabled on `qc_reports`.
- Any active user can view and create reports. Only the report creator or an administrator can edit
  a report. Only administrators can delete reports.

5. Notes
- Existing tables are not changed.
- Measurements are optional so a report can be saved while a test is still running.
*/

CREATE SEQUENCE IF NOT EXISTS public.qc_report_seq;

CREATE TABLE IF NOT EXISTS public.qc_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_no text NOT NULL UNIQUE DEFAULT ('QC-' || lpad(nextval('public.qc_report_seq')::text, 5, '0')),
  report_date date NOT NULL DEFAULT current_date,
  shift text NOT NULL CHECK (shift IN ('A', 'B', 'C')),
  machine_no text NOT NULL CHECK (char_length(trim(machine_no)) > 0),
  operator_name text NOT NULL CHECK (char_length(trim(operator_name)) > 0),
  job_card_no text NOT NULL CHECK (char_length(trim(job_card_no)) > 0),
  customer_name text NOT NULL CHECK (char_length(trim(customer_name)) > 0),
  film_structure text NOT NULL CHECK (char_length(trim(film_structure)) > 0),
  gsm_check numeric,
  micron numeric,
  seal_strength_n numeric,
  peel_test text CHECK (peel_test IN ('Pass', 'Fail')),
  lamination_bond_strength numeric,
  corona_dyne numeric,
  registration_check text CHECK (registration_check IN ('Pass', 'Fail')),
  color_delta_e numeric,
  bag_check text CHECK (bag_check IN ('Pass', 'Fail')),
  leak_test text CHECK (leak_test IN ('Pass', 'Fail')),
  sample_qty integer NOT NULL CHECK (sample_qty > 0),
  defective_qty integer NOT NULL DEFAULT 0 CHECK (defective_qty >= 0 AND defective_qty <= sample_qty),
  defect_type text CHECK (defect_type IN ('Printing Shade', 'Wrinkle', 'Loose Sealing', 'Cutting Issue', 'Ink Smudging')),
  defect_pct numeric GENERATED ALWAYS AS (round(defective_qty::numeric / sample_qty * 100, 2)) STORED,
  grade text GENERATED ALWAYS AS (
    CASE
      WHEN defective_qty::numeric / sample_qty * 100 < 2 THEN 'A'
      WHEN defective_qty::numeric / sample_qty * 100 <= 5 THEN 'B'
      ELSE 'Rejected'
    END
  ) STORED,
  status text NOT NULL DEFAULT 'Hold' CHECK (status IN ('Approved', 'Hold', 'Rejected')),
  defect_image_path text,
  signature_data text,
  officer_name text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS qc_reports_report_date_idx ON public.qc_reports (report_date DESC);
CREATE INDEX IF NOT EXISTS qc_reports_customer_idx ON public.qc_reports (customer_name);

ALTER TABLE public.qc_reports ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.qc_reports TO authenticated;
GRANT USAGE ON SEQUENCE public.qc_report_seq TO authenticated;

DROP POLICY IF EXISTS "select_qc_reports" ON public.qc_reports;
CREATE POLICY "select_qc_reports" ON public.qc_reports FOR SELECT
  TO authenticated USING (private.is_active_user());

DROP POLICY IF EXISTS "insert_qc_reports" ON public.qc_reports;
CREATE POLICY "insert_qc_reports" ON public.qc_reports FOR INSERT
  TO authenticated WITH CHECK (private.is_active_user() AND created_by = auth.uid());

DROP POLICY IF EXISTS "update_own_or_admin_qc_reports" ON public.qc_reports;
CREATE POLICY "update_own_or_admin_qc_reports" ON public.qc_reports FOR UPDATE
  TO authenticated
  USING (private.is_active_user() AND (created_by = auth.uid() OR private.is_admin()))
  WITH CHECK (private.is_active_user() AND (created_by = auth.uid() OR private.is_admin()));

DROP POLICY IF EXISTS "delete_admin_qc_reports" ON public.qc_reports;
CREATE POLICY "delete_admin_qc_reports" ON public.qc_reports FOR DELETE
  TO authenticated USING (private.is_active_user() AND private.is_admin());

INSERT INTO storage.buckets (id, name, public)
VALUES ('qc-attachments', 'qc-attachments', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "insert_qc_attachments" ON storage.objects;
CREATE POLICY "insert_qc_attachments" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (bucket_id = 'qc-attachments' AND private.is_active_user());

DROP POLICY IF EXISTS "delete_admin_qc_attachments" ON storage.objects;
CREATE POLICY "delete_admin_qc_attachments" ON storage.objects FOR DELETE
  TO authenticated USING (bucket_id = 'qc-attachments' AND private.is_active_user() AND private.is_admin());
