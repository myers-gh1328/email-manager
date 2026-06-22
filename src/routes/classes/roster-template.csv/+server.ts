export const GET = () =>
  new Response('First Name,Last Name,Email,Phone,Notes\nMaya,Patel,maya@example.com,555-0100,Needs rental gear\n', {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="scuba-roster-template.csv"'
    }
  });
