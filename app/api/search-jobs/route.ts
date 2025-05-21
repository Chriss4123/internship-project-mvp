import axios from 'axios';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { roles, location, field } = await request.json();

    if (!roles || roles.length === 0 || !location || !field) {
      return NextResponse.json({ error: 'Missing required fields: roles, location, field' }, { status: 400 });
    }

    const roleQuery = roles.join(' or ');
    const searchQuery = `${roleQuery} internship in ${location}`;

    const options = {
      method: 'GET',
      url: 'https://jsearch.p.rapidapi.com/search',
      params: {
        query: searchQuery,
        num_pages: '1',
      },
      headers: {
        'X-RapidAPI-Key': process.env.RAPIDAPI_KEY!,
        'X-RapidAPI-Host': 'jsearch.p.rapidapi.com'
      }
    };

    const response = await axios.request(options);
    
    const relevantJobs = response.data.data?.filter((job: any) => {
      const title = job.job_title?.toLowerCase() || '';
      const description = job.job_description?.toLowerCase() || '';
      return title.includes('intern') || title.includes('graduate') || title.includes('entry') || title.includes('junior') ||
             description.includes('intern') || description.includes('graduate') || description.includes('entry level');
    }).slice(0, 15);

    return NextResponse.json({ jobs: relevantJobs || [] });

  } catch (error: any) {
    console.error('JSearch API Error:', error.response?.data || error.message);
    return NextResponse.json({ error: 'Failed to fetch jobs from JSearch API', details: error.message }, { status: 500 });
  }
}