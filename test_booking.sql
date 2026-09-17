-- Quick test to verify salon extension is working
-- Run this to see the new tables

SELECT 'employees' as table_name, COUNT(*) as row_count FROM employees
UNION ALL
SELECT 'services', COUNT(*) FROM services
UNION ALL
SELECT 'service_providers', COUNT(*) FROM service_providers
UNION ALL
SELECT 'working_hours', COUNT(*) FROM working_hours
UNION ALL
SELECT 'availability_exceptions', COUNT(*) FROM availability_exceptions
UNION ALL
SELECT 'appointments', COUNT(*) FROM appointments;
