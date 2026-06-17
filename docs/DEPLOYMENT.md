# Deployment Notes

## Orphaned GKE landing deployment

The `agentdance-landing` Deployment currently observed in the `agentdance`
namespace on the `clusterkit` GKE cluster is not governed by this repository.

The previous GKE landing pipeline and Helm chart were intentionally removed in
commit `9fa6cbd` (`chore: remove broken GKE landing pipeline + helm chart (#1)`).
The remaining GitHub workflows only run CI checks and build Tauri desktop
releases; they do not build, tag, push, or deploy the
`us-docker.pkg.dev/baldmaninc/gcr.io/agentdance-landing` image.

This means the cluster workload using
`us-docker.pkg.dev/baldmaninc/gcr.io/agentdance-landing:latest` should be treated
as orphaned cluster state, not as a deployment managed from this repo.

Before remediating the `:latest` image in-cluster, choose one source-of-truth:

- Reintroduce a reviewed build and deploy pipeline that publishes immutable
  image tags and updates a tracked manifest or Helm chart.
- Tear down the stale `agentdance-landing` workload from the cluster through the
  normal cluster change process.

Do not pin the live cluster Deployment directly unless a new source-of-truth is
created or identified first.
