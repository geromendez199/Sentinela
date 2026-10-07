-- Production was intentionally paused during the beta rollout. The resilience
-- queues and Edge Function versions are now live, so resume the scheduler.
do $$
begin
  perform cron.alter_job(jobid, active := true)
  from cron.job
  where jobname like 'sentinela-%'
    and jobname <> 'sentinela-create-partitions';
end;
$$;
