import { getJson } from '../api/client.js';
import { useApiResource } from '../hooks/useApiResource.js';

type WorkoutSuggestion = { _id?: string; title: string; focus?: string; minutes?: number; difficulty?: string; reason?: string };
type WorkoutResponse = { suggestions: WorkoutSuggestion[] };

const userEmail = 'mona@example.com';
const loadWorkouts = () => getJson<WorkoutResponse>(`/api/workouts/suggestions/${encodeURIComponent(userEmail)}`);

export default function Workouts() {
  const state = useApiResource(loadWorkouts);

  return <section className="card h-100"><div className="card-body">
    <h2 className="h4">Workout suggestions</h2>
    <p>Recommend workouts from activity patterns.</p>
    {state.status === 'loading' && <p role="status">Loading workout suggestions...</p>}
    {state.status === 'error' && <p role="alert">Unable to load workout suggestions: {state.message}</p>}
    {state.status === 'success' && (state.data.suggestions.length === 0
      ? <p>No workout suggestions yet.</p>
      : <ul className="list-group">{state.data.suggestions.map((workout, index) =>
        <li className="list-group-item" key={workout._id ?? `${workout.title}-${index}`}>
          <strong>{workout.title}</strong>{workout.focus ? ` - ${workout.focus}` : ''}
          {workout.minutes !== undefined && <div>{workout.minutes} minutes{workout.difficulty ? `, ${workout.difficulty}` : ''}</div>}
          {workout.reason && <p className="mb-0">{workout.reason}</p>}
        </li>,
      )}</ul>)}
  </div></section>;
}
