// Active Recovery / Mobility workout — shown in Strength section for coach and athletes

export const MOBILITY_WORKOUT = {
  id: 'mobility',
  title: 'Mobility',
  type: 'Active Recovery',
  typeBadge: 'bg-emerald-100 text-emerald-800',
  note: 'Complete all sections in order. Take your time and focus on quality movement — not speed. Use a foam roller or lacrosse ball for soft tissue work.',
  // Sections-based format (different from exercise-based strength workouts)
  sections: [
    {
      roman: 'I',
      name: 'Soft Tissue',
      description: 'Foam roll / lacrosse ball each area until tension releases.',
      items: [
        'Shins',
        'Quads',
        'Calves',
        'Hamstrings',
        'Glutes',
        'Sweet Spot (piriformis)',
        'Full Back',
        'Feet',
      ],
    },
    {
      roman: 'II',
      name: 'Mobility',
      description: 'Move slowly and deliberately through each exercise.',
      items: [
        'Weighted Ankle 3-Way Mob. × 3 ea.',
        'Hip 90/90 Stretch × 3 ea.',
        'Hip 90/90 Windshield Wipers × 5 ea.',
        '½ Kneeling Hip Flexor Stretch × 5 ea.',
        'Reverse Snow Angels (5s tempo) × 3 ea.',
        'Quadruped T-Spine Rotations × 5 ea.',
        'Spiderman Sequence × 5 ea.',
      ],
    },
    {
      roman: 'III',
      name: 'Band Stretch',
      description: 'Use a resistance band for each stretch. Hold 30–60 seconds.',
      items: [
        'Calves',
        'Hamstrings',
        'Groin',
        'Glutes',
        'Quads',
      ],
    },
    {
      roman: 'IV',
      name: 'Activation',
      description: '1–3 rounds. Keep quality high.',
      items: [
        'Vertical Jumps × 5',
        'TRX Rows × 8',
        'Dead Bug × 5 ea.',
        'Mini Band Monster Walks × 10/10',
        'Push Ups × 5–10',
        'Bird Dogs × 5 ea.',
      ],
    },
  ],
}
