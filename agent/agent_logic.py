class AgentRuleSystem:
    def __init__(self):
        pass
        
    def evaluate_vitals(self, initial_severity, vitals):
        """Rule-based system to dynamically override MLE severity if vitals are extreme."""
        oxygen = float(vitals.get("oxygen", 98))
        heart_rate = float(vitals.get("heart_rate", 70))
        
        # Agent Logic overriding ML output
        if oxygen < 85 or heart_rate > 120:
            severity = "Critical"
        elif oxygen < 90 or heart_rate > 100:
            severity = "High"
        elif oxygen < 95 or heart_rate > 80:
            severity = "Medium"
        else:
            severity = "Low"
                
        return severity

    def run_agent_monitoring(self, queue_instance):
        """Iterates over priority queue, applies rules, and dynamically reorders"""
        new_queue = []
        for item in queue_instance.queue:
            _, patient_id, severity, arrival_time, data = item

            # Agent reassesses severity
            updated_severity = self.evaluate_vitals(severity, data)
            heap_key = queue_instance.calculate_priority(updated_severity, arrival_time)

            new_queue.append((heap_key, patient_id, updated_severity, arrival_time, data))

        import heapq
        heapq.heapify(new_queue)
        queue_instance.queue = new_queue
        return queue_instance
