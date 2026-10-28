/** Data available to the read-only monitoring interface, independent of collectors. */
export interface ObservationView {
  context: string; generatedAt: string; expiresAt: string; ok: boolean;
  nodes: Array<{ hostname: string; address?: string; role: string; leader: boolean; state: string; reachability: string; availability: string }>;
  quorum: { healthy: number; managers: number; required: number; state: string };
  apps: Array<{
    app: string; ok: boolean; outcome: string;
    services: Array<{ name: string; running: number; desired: number; expectedImage: string; image: string; actualDigests?: string[]; issues?: string[]; updateState: string }>;
    unexpectedServices?: string[];
    failedTasks?: Array<{ service?: string | undefined; state?: string | undefined; category: string; timestamp?: string | undefined }>;
    checks: Array<{ name: string; ok: boolean; detail: string; url?: string }>;
    hints: string[];
  }>;
  monitoring: { state: string; healthyTargets?: number; totalTargets?: number; firingAlerts?: number; links?: Record<string, string> };
  operation: { operation: string; phase: string; state: string } | null;
  history: Array<{ operation: string; state: string; events?: Array<{ phase: string; at: string }> }>;
  gaps: string[]; notifications: string;
}
