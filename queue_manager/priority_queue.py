import heapq
import time

class HospitalQueue:
    def __init__(self):
        self.queue = []
        self.severity_map = {
            "Critical": 1,
            "High": 2,
            "Medium": 3,
            "Low": 4,
            "Unknown": 5
        }

    def _heap_key(self, severity_level, arrival_time):
        """
        Strict triage ordering for min-heap:
        1) Severity rank (Critical first)
        2) Longer waiting time within same severity (-waiting_time)
        3) Earlier arrival time (FIFO tie-break)
        """
        severity_rank = self.severity_map.get(severity_level, 5)
        waiting_time = time.time() - arrival_time
        return (severity_rank, -waiting_time, arrival_time)

    def calculate_priority(self, severity_level, arrival_time):
        """Returns heap sort key used for triage ordering."""
        return self._heap_key(severity_level, arrival_time)

    def add_patient(self, patient_id, severity_level, arrival_time, data):
        """Inserts patient into heap priority queue."""
        heap_key = self._heap_key(severity_level, arrival_time)
        patient_record = (heap_key, patient_id, severity_level, arrival_time, data)
        heapq.heappush(self.queue, patient_record)
        return heap_key

    def remove_from_queue(self, patient_id):
        """Removes a patient from the queue by ID and rebuilds the heap."""
        self.queue = [item for item in self.queue if item[1] != patient_id]
        heapq.heapify(self.queue)

    def rebuild_queue(self):
        """Recalculate heap keys (waiting time/severity) and rebuild heap."""
        updated_queue = []
        for item in self.queue:
            _, patient_id, severity, arrival_time, data = item
            heap_key = self._heap_key(severity, arrival_time)
            updated_queue.append((heap_key, patient_id, severity, arrival_time, data))

        heapq.heapify(updated_queue)
        self.queue = updated_queue

    def get_queue(self):
        """Returns sorted queue using severity -> waiting time -> arrival order."""
        self.rebuild_queue()

        sorted_list = sorted(self.queue, key=lambda x: x[0])
        return [
            {
                "patient_id": row[1],
                "severity": row[2],
                "priority_score": row[0][0],
                "waiting_time_sec": round(time.time() - row[3], 1),
                "data": row[4]
            } for row in sorted_list
        ]
