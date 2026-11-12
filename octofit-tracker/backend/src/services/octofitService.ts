import mongoose from 'mongoose';
import { Activity, Team, User, Workout } from '../models/index.js';

function httpError(message: string, status: number) {
  return Object.assign(new Error(message), { status });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function listActivities() {
  return Activity.find().lean();
}

export async function createActivity(input: unknown) {
  if (!isRecord(input)) throw httpError('Activity body must be an object', 400);
  const { userId, teamId, type, minutes } = input;
  if (
    typeof userId !== 'string' ||
    !mongoose.isValidObjectId(userId) ||
    typeof teamId !== 'string' ||
    !mongoose.isValidObjectId(teamId) ||
    typeof type !== 'string' ||
    type.trim().length === 0 ||
    typeof minutes !== 'number' ||
    !Number.isFinite(minutes) ||
    minutes < 1
  ) {
    throw httpError('Valid userId, teamId, type, and minutes are required', 400);
  }

  const [user, team] = await Promise.all([User.findById(userId), Team.findById(teamId)]);
  if (!user || !team) throw httpError('Activity user or team was not found', 404);

  return Activity.create({
    user: user._id,
    team: team._id,
    type: type.trim(),
    minutes,
    points: minutes,
    occurredAt: new Date(),
  });
}

export async function listTeams() {
  return Team.find().lean();
}

export async function createTeam(input: unknown) {
  if (!isRecord(input)) throw httpError('Team body must be an object', 400);
  const { name, mascot } = input;
  const members = input.members ?? [];
  if (
    typeof name !== 'string' ||
    name.trim().length === 0 ||
    typeof mascot !== 'string' ||
    mascot.trim().length === 0 ||
    !Array.isArray(members) ||
    members.some((member) => typeof member !== 'string' || !mongoose.isValidObjectId(member))
  ) {
    throw httpError('Valid name, mascot, and member IDs are required', 400);
  }

  const users = members.length ? await User.find({ _id: { $in: members } }).select('_id') : [];
  if (users.length !== members.length) throw httpError('One or more team members were not found', 404);

  return Team.create({
    name: name.trim(),
    mascot: mascot.trim(),
    members: users.map((user) => user._id),
  });
}

export async function getLeaderboard() {
  const [teams, totals] = await Promise.all([
    Team.find().select('name').lean(),
    Activity.aggregate<{ _id: mongoose.Types.ObjectId; totalPoints: number }>([
      { $group: { _id: '$team', totalPoints: { $sum: '$points' } } },
    ]),
  ]);
  const pointsByTeam = new Map(totals.map(({ _id, totalPoints }) => [_id.toString(), totalPoints]));
  return teams
    .map((team) => ({
      teamName: team.name,
      totalPoints: pointsByTeam.get(team._id.toString()) ?? 0,
    }))
    .sort((left, right) => right.totalPoints - left.totalPoints || left.teamName.localeCompare(right.teamName))
    .map((team, index) => ({ ...team, rank: index + 1 }));
}

export async function suggestWorkouts(userEmail: string) {
  const user = await User.findOne({ email: userEmail.trim().toLowerCase() }).lean();
  if (!user) throw httpError('User was not found', 404);

  const [recentActivity, workouts] = await Promise.all([
    Activity.findOne({ user: user._id }).sort({ occurredAt: -1 }).lean(),
    Workout.find().lean(),
  ]);
  const normalize = (value: string) => value.trim().toLowerCase();
  const goalFocus = normalize(user.fitnessGoal);
  const activityType = recentActivity?.type;
  const activityFocus = activityType
    ? ({ run: 'endurance', cycle: 'endurance', walk: 'endurance' }[normalize(activityType)] ?? normalize(activityType))
    : undefined;
  const focus = [activityFocus, goalFocus].find((candidate) =>
    candidate && workouts.some((workout) => normalize(workout.focus) === candidate),
  );
  const orderedWorkouts = [...workouts].sort((left, right) => {
    const leftMatches = focus !== undefined && normalize(left.focus) === focus;
    const rightMatches = focus !== undefined && normalize(right.focus) === focus;
    return Number(rightMatches) - Number(leftMatches) || (left.title ?? '').localeCompare(right.title ?? '');
  });
  const reason = activityType && focus === activityFocus
    ? `Recommended based on your recent ${activityType} activity.`
    : `Recommended to support your ${user.fitnessGoal} fitness goal.`;
  return orderedWorkouts.map((workout) => ({ ...workout, reason }));
}

export { User };
