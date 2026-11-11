# Smart Classroom Environment Monitoring

Teachers, students, and evaluators monitor a working ESP32 remotely. Live temperature, humidity, PIR state, firmware LED reports, and trustworthy freshness are the primary tasks. History supports investigation. PIR is not attendance. Pins and 32°C/35°C thresholds are fixed. All sensor data comes from Firebase and requires an authorized account.

The user confirmed a light neutral minimalist dashboard, editable Classroom 01 naming, responsive navigation, dark mode, and green/amber/red/gray states. Configuration belongs in ignored local files.

Occupancy is an ESP32-generated estimate with a ten-minute inactivity timeout: Likely occupied, No recent activity, or unknown on restart/stale telemetry. Keep the raw PIR state and motion-event count separate from this estimate. Quiet activity can be missed; neither state is a people count or proof of vacancy.
